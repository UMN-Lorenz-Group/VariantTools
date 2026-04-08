"""
Merge API router — VCF Merger module.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.core.file_manager import get_output_path, save_upload
from backend.db.models import Job, get_session
from backend.tasks.vcf_tasks import run_merge_task

router = APIRouter(prefix="/api/merge", tags=["merge"])


class MergeSubmitRequest(BaseModel):
    file_ids: List[str]
    norm_multiallelic: bool = False
    output_filename: str = "merged.vcf.gz"


@router.post("/upload")
async def upload_files(files: List[UploadFile] = File(...)):
    """Accept multiple VCF files and save them. Returns list of file_ids (saved paths)."""
    if not files:
        raise HTTPException(status_code=400, detail="No files provided.")

    saved = []
    for upload in files:
        filename = upload.filename or "unknown.vcf"
        if not (filename.endswith(".vcf") or filename.endswith(".vcf.gz")):
            raise HTTPException(
                status_code=400,
                detail=f"File '{filename}' is not a VCF file (.vcf or .vcf.gz).",
            )
        content = await upload.read()
        if len(content) == 0:
            raise HTTPException(
                status_code=400, detail=f"Uploaded file '{filename}' is empty."
            )
        path = save_upload(filename, content)
        saved.append({"file_id": path, "filename": filename, "size": len(content)})

    return {"uploaded_files": saved}


@router.post("/submit")
async def submit_merge(body: MergeSubmitRequest):
    """Submit a merge job with the provided file_ids and options. Returns job_id."""
    if len(body.file_ids) < 2:
        raise HTTPException(
            status_code=400, detail="At least 2 files are required for merging."
        )

    # Validate all file paths exist
    for fid in body.file_ids:
        if not Path(fid).exists():
            raise HTTPException(
                status_code=404, detail=f"File not found: {fid}"
            )

    job_id = str(uuid.uuid4())
    output_filename = body.output_filename
    if not output_filename.endswith(".vcf.gz"):
        output_filename += ".vcf.gz"
    output_path = get_output_path(job_id, output_filename)

    with get_session() as session:
        job = Job(
            id=job_id,
            module="merge",
            status="pending",
            input_files=json.dumps(body.file_ids),
            created_at=datetime.utcnow(),
        )
        session.add(job)
        session.commit()

    task = run_merge_task.delay(
        job_id,
        body.file_ids,
        output_path,
        body.norm_multiallelic,
    )

    with get_session() as session:
        job = session.get(Job, job_id)
        if job:
            job.celery_task_id = task.id
            session.add(job)
            session.commit()

    return {"job_id": job_id, "status": "pending"}


@router.get("/status/{job_id}")
async def get_status(job_id: str):
    """Return job status and summary when completed."""
    with get_session() as session:
        job = session.get(Job, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found.")

        response: dict = {
            "job_id": job.id,
            "status": job.status,
            "module": job.module,
            "created_at": job.created_at.isoformat(),
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "error_message": job.error_message,
            "result": None,
        }

        if job.status == "completed" and job.result_json:
            result_data = json.loads(job.result_json)
            # Enrich with input file count from DB record
            try:
                input_files = json.loads(job.input_files)
                result_data["input_file_count"] = len(input_files)
            except Exception:
                pass
            response["result"] = result_data

        return response


@router.get("/download/{job_id}")
async def download_merged(job_id: str):
    """Stream the merged VCF file for download."""
    with get_session() as session:
        job = session.get(Job, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found.")
        if job.status != "completed":
            raise HTTPException(
                status_code=409,
                detail=f"Job is not completed (current status: {job.status}).",
            )
        if not job.output_file or not Path(job.output_file).exists():
            raise HTTPException(status_code=404, detail="Output file not found.")

        return FileResponse(
            path=job.output_file,
            media_type="application/gzip",
            filename=Path(job.output_file).name.split("_", 1)[-1],
        )
