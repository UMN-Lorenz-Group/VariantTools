"""
Fix Reference API router — REF allele mismatch correction using bcftools +fixref.
"""

import asyncio
import json
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.core.file_manager import save_upload, get_output_path, UPLOAD_DIR
from backend.core.fixref import run_fixref_check, parse_fixref_stats
from backend.db.models import Job, get_session
from backend.tasks.vcf_tasks import run_fixref_fix_task

router = APIRouter(prefix="/api/fixref", tags=["fixref"])


# ---------------------------------------------------------------------------
# Request/response models
# ---------------------------------------------------------------------------

class CheckRequest(BaseModel):
    file_id: str
    ref_path: str   # server-side absolute path OR file_id from /upload-ref


class FixRequest(BaseModel):
    file_id: str
    ref_path: str   # server-side absolute path OR file_id from /upload-ref
    output_filename: str


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _resolve_ref_path(ref_path: str) -> str:
    """Resolve ref_path to an absolute filesystem path.

    ref_path may be:
      1. A server-side absolute path to a FASTA (e.g. /data/refs/Gmax_880_v6.0.fa)
      2. A file_id returned by POST /upload-ref (i.e., a path under UPLOAD_DIR)

    Raises HTTPException 404 if the resolved path does not exist.
    """
    candidate = Path(ref_path)

    # Check if it's a direct existing path
    if candidate.exists():
        return str(candidate)

    # It might be a relative path under UPLOAD_DIR
    upload_candidate = Path(UPLOAD_DIR) / ref_path
    if upload_candidate.exists():
        return str(upload_candidate)

    # Treat the whole ref_path as an absolute-or-relative path that doesn't exist
    raise HTTPException(
        status_code=404,
        detail=(
            f"Reference FASTA not found at '{ref_path}'. "
            "Either provide an absolute server path to an installed FASTA, "
            "or use POST /api/fixref/upload-ref and pass the returned file_id."
        ),
    )


# ---------------------------------------------------------------------------
# Upload endpoints
# ---------------------------------------------------------------------------

@router.post("/upload")
async def upload_vcf(file: UploadFile = File(...)):
    """Upload a VCF file for fixref processing.

    Returns a file_id (saved path) to use in /check and /fix.
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

    saved_path = save_upload(filename, content)
    return {"file_id": saved_path, "filename": filename}


@router.post("/upload-ref")
async def upload_ref_fasta(file: UploadFile = File(...)):
    """Upload a reference FASTA file.

    Returns a ref_id (saved path) to pass as ref_path in /check and /fix.
    Warning: large FASTA files may time out during upload.
    """
    if file.filename is None:
        raise HTTPException(status_code=400, detail="No filename provided.")

    filename = file.filename
    allowed = (".fa", ".fasta", ".fa.gz", ".fasta.gz")
    if not any(filename.endswith(ext) for ext in allowed):
        raise HTTPException(
            status_code=400,
            detail="Only .fa, .fasta, .fa.gz, and .fasta.gz files are accepted.",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    saved_path = save_upload(filename, content)
    return {"ref_id": saved_path, "filename": filename}


# ---------------------------------------------------------------------------
# Check endpoint (synchronous — no Celery)
# ---------------------------------------------------------------------------

@router.post("/check")
async def check_fixref(body: CheckRequest):
    """Run bcftools +fixref in check mode synchronously and return stats.

    This is read-only and fast enough to run inline (60-second timeout).
    No Celery task is used.
    """
    # Validate VCF
    vcf_path = body.file_id
    if not Path(vcf_path).exists():
        raise HTTPException(status_code=404, detail="VCF file not found.")

    # Resolve reference path
    ref_path = _resolve_ref_path(body.ref_path)

    # Run check with 60-second timeout
    try:
        stdout, stderr = await asyncio.wait_for(
            run_fixref_check(vcf_path, ref_path),
            timeout=60.0,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="bcftools +fixref check timed out after 60 seconds.",
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    stats = parse_fixref_stats(stdout + "\n" + stderr)
    return {"stats": stats}


# ---------------------------------------------------------------------------
# Fix endpoint (Celery task)
# ---------------------------------------------------------------------------

@router.post("/fix")
async def submit_fix(body: FixRequest):
    """Submit a bcftools +fixref fix job.

    Returns a job_id for polling via /status/{job_id}.
    """
    # Validate VCF
    vcf_path = body.file_id
    if not Path(vcf_path).exists():
        raise HTTPException(status_code=404, detail="VCF file not found.")

    # Resolve reference path
    ref_path = _resolve_ref_path(body.ref_path)

    # Create output path
    output_path = get_output_path(str(uuid.uuid4()), body.output_filename)

    # Create job record
    job_id = str(uuid.uuid4())
    with get_session() as session:
        job = Job(
            id=job_id,
            module="fixref",
            status="pending",
            input_files=json.dumps([Path(vcf_path).name]),
            created_at=datetime.utcnow(),
        )
        session.add(job)
        session.commit()

    # Submit Celery task
    task = run_fixref_fix_task.delay(job_id, vcf_path, ref_path, output_path)

    # Update job with Celery task id
    with get_session() as session:
        job = session.get(Job, job_id)
        if job:
            job.celery_task_id = task.id
            session.add(job)
            session.commit()

    return {"job_id": job_id, "status": "pending"}


# ---------------------------------------------------------------------------
# Status and download
# ---------------------------------------------------------------------------

@router.get("/status/{job_id}")
async def get_fixref_status(job_id: str):
    """Return job status and before/after stats if completed."""
    with get_session() as session:
        job = session.get(Job, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found.")

        result: dict = {
            "job_id": job.id,
            "status": job.status,
            "module": job.module,
            "created_at": job.created_at.isoformat(),
            "completed_at": job.completed_at.isoformat() if job.completed_at else None,
            "error_message": job.error_message,
            "before": None,
            "after": None,
        }

        if job.status == "completed" and job.result_json:
            summary = json.loads(job.result_json)
            result["before"] = summary.get("before")
            result["after"] = summary.get("after")

        return result


@router.get("/download/{job_id}")
async def download_fixed_vcf(job_id: str):
    """Stream the fixed VCF file."""
    with get_session() as session:
        job = session.get(Job, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found.")
        if job.status != "completed":
            raise HTTPException(
                status_code=409,
                detail=f"Job is not completed (status: {job.status}).",
            )
        if not job.output_file or not Path(job.output_file).exists():
            raise HTTPException(status_code=404, detail="Output file not found.")

        output_path = Path(job.output_file)
        return FileResponse(
            path=str(output_path),
            media_type="application/octet-stream",
            filename=output_path.name,
        )
