"""
VCF Generator API router — Phase 3.
"""

import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.core.file_manager import get_output_path, save_upload
from backend.core.vcf_generator import parse_genotype_table, parse_snp_info_table
from backend.db.models import Job, get_session
from backend.tasks.vcf_tasks import run_generator_task

router = APIRouter(prefix="/api/generator", tags=["generator"])

# Accepted file extensions
_GENO_EXTENSIONS = {".genotypes", ".csv", ".tsv", ".txt"}
_SNP_EXTENSIONS = {".txt", ".csv", ".tsv", ".bed"}


# ---------------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------------

class GenerateRequest(BaseModel):
    geno_file_id: str
    snp_file_id: str
    assembly: str
    output_filename: str = "output.vcf"
    orientation: str = "auto"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _check_extension(filename: str, allowed: set[str]) -> None:
    suffix = Path(filename).suffix.lower()
    if suffix not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"File '{filename}' has unsupported extension '{suffix}'. Allowed: {sorted(allowed)}",
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/upload-genotypes")
async def upload_genotypes(
    file: UploadFile = File(...),
    orientation: str = "auto",
):
    """Accept a single genotype matrix file and return a preview.

    orientation: 'samples_as_rows' | 'snps_as_rows' | 'auto'
    """
    filename = file.filename or "upload.txt"
    _check_extension(filename, _GENO_EXTENSIONS)

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        sample_ids, snp_ids, matrix = parse_genotype_table(content, sep="auto")
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to parse genotype file: {exc}")

    # Save to disk for later use in generate step
    file_id = save_upload(filename, content)

    # Build preview: first 3 samples × first 5 SNPs
    preview_samples = sample_ids[:3]
    preview_snps = snp_ids[:5]
    preview: list[dict] = []
    for i, sid in enumerate(preview_samples):
        row: dict = {"sample_id": sid}
        for j, snp in enumerate(preview_snps):
            row[snp] = matrix[i][j] if j < len(matrix[i]) else ""
        preview.append(row)

    return {
        "file_id": file_id,
        "sample_count": len(sample_ids),
        "snp_count": len(snp_ids),
        "orientation_detected": orientation,
        "preview": preview,
    }


@router.post("/upload-snp-info")
async def upload_snp_info(
    file: UploadFile = File(...),
):
    """Accept a single SNP info file and return a preview."""
    filename = file.filename or "snp_info.txt"
    _check_extension(filename, _SNP_EXTENSIONS)

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        records = parse_snp_info_table(content, sep="auto")
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to parse SNP info file: {exc}")

    # Save to disk
    file_id = save_upload(filename, content)

    # Columns found (non-dot values)
    first = records[0] if records else {}
    columns_found = [k for k, v in first.items() if v != "."]

    # Preview: first 5 rows
    preview = [
        {
            "CHROM": r["CHROM"],
            "POS": r["POS"],
            "ID": r["ID"],
            "REF": r["REF"],
            "ALT": r["ALT"],
        }
        for r in records[:5]
    ]

    return {
        "file_id": file_id,
        "snp_count": len(records),
        "columns_found": columns_found,
        "preview": preview,
    }


@router.post("/generate")
async def generate_vcf(body: GenerateRequest):
    """Submit a VCF generation job.

    Validates both uploaded files exist, creates a Job record,
    and submits the Celery task.
    Returns {job_id, status: 'pending'}.
    """
    if not Path(body.geno_file_id).exists():
        raise HTTPException(status_code=404, detail=f"Genotype file not found: {body.geno_file_id}")
    if not Path(body.snp_file_id).exists():
        raise HTTPException(status_code=404, detail=f"SNP info file not found: {body.snp_file_id}")
    if not body.assembly.strip():
        raise HTTPException(status_code=400, detail="Assembly name is required.")

    job_id = str(uuid.uuid4())
    output_filename = body.output_filename.strip() or "output.vcf"
    if not output_filename.endswith(".vcf"):
        output_filename += ".vcf"
    output_path = get_output_path(job_id, output_filename)

    with get_session() as session:
        job = Job(
            id=job_id,
            module="generator",
            status="pending",
            input_files=json.dumps([body.geno_file_id, body.snp_file_id]),
            created_at=datetime.utcnow(),
        )
        session.add(job)
        session.commit()

    task = run_generator_task.delay(
        job_id,
        body.geno_file_id,
        body.snp_file_id,
        body.assembly,
        output_path,
        body.orientation,
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
    """Return job status and result summary when completed."""
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
            # Enrich with file size if output exists
            if job.output_file and Path(job.output_file).exists():
                result_data["file_size"] = os.path.getsize(job.output_file)
            response["result"] = result_data

        return response


@router.get("/download/{job_id}")
async def download_vcf(job_id: str):
    """Stream the generated VCF file for download."""
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
            raise HTTPException(status_code=404, detail="Output VCF file not found.")

        return FileResponse(
            path=job.output_file,
            media_type="text/plain",
            filename=Path(job.output_file).name.split("_", 1)[-1],
        )
