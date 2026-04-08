"""
Stats API router — VCF Stats & Assembly Detection module.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse, StreamingResponse

from backend.core.bcftools import parse_vcf_header
from backend.core.file_manager import save_upload
from backend.db.models import Job, create_db_and_tables, get_session
from backend.tasks.vcf_tasks import run_stats_task

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.post("/upload-and-analyze")
async def upload_and_analyze(file: UploadFile = File(...)):
    """Accept a VCF upload, parse header immediately, and kick off a Celery stats task.

    Returns assembly info right away, plus the job_id for polling.
    """
    if file.filename is None:
        raise HTTPException(status_code=400, detail="No filename provided.")

    filename = file.filename
    if not (filename.endswith(".vcf") or filename.endswith(".vcf.gz")):
        raise HTTPException(
            status_code=400,
            detail="Only .vcf and .vcf.gz files are accepted.",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Save to disk
    saved_path = save_upload(filename, content)

    # Parse header synchronously — fast, no subprocess needed
    try:
        header_info = parse_vcf_header(saved_path)
    except Exception as exc:
        raise HTTPException(
            status_code=422, detail=f"Failed to parse VCF header: {exc}"
        )

    # Create job record
    job_id = str(uuid.uuid4())
    with get_session() as session:
        job = Job(
            id=job_id,
            module="stats",
            status="pending",
            input_files=json.dumps([filename]),
            created_at=datetime.utcnow(),
        )
        session.add(job)
        session.commit()

    # Submit Celery task
    task = run_stats_task.delay(job_id, saved_path)

    # Update job with task ID
    with get_session() as session:
        job = session.get(Job, job_id)
        if job:
            job.celery_task_id = task.id
            session.add(job)
            session.commit()

    assembly_info = {
        "assembly_guess": header_info["assembly_guess"],
        "reference": header_info["reference"],
        "file_format": header_info["file_format"],
        "contig_count": len(header_info["contig_lines"]),
        "recognized": header_info["assembly_guess"] is not None,
    }

    return {
        "job_id": job_id,
        "assembly_info": assembly_info,
        "status": "pending",
    }


@router.get("/result/{job_id}")
async def get_result(job_id: str):
    """Return job status and parsed stats when completed."""
    with get_session() as session:
        job = session.get(Job, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found.")

        result = {
            "job_id": job.id,
            "status": job.status,
            "module": job.module,
            "created_at": job.created_at.isoformat(),
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "error_message": job.error_message,
            "stats": None,
        }

        if job.status == "completed" and job.result_json:
            result["stats"] = json.loads(job.result_json)

        return result


@router.get("/download/{job_id}")
async def download_stats(job_id: str):
    """Stream the raw bcftools stats text file for download."""
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
            media_type="text/plain",
            filename=f"bcftools_stats_{job_id}.txt",
        )
