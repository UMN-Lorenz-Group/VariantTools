"""
VCF Generator API router — Phase 3.
"""

import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Literal, Optional

from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel

from backend.core.bcftools import parse_vcf_header, run_bcftools_validate
from backend.core.file_manager import get_output_path, save_upload
from backend.core.vcf_generator import (
    parse_genotype_table,
    parse_snp_info_table,
    parse_agriplex_table,
    parse_dartag_table,
)
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
    snp_file_id: str = ""
    assembly: str
    output_filename: str = "output.vcf"
    orientation: str = "auto"
    input_type: str = "genotype_matrix"   # "genotype_matrix" | "agriplex" | "dartag"
    header_file_id: Optional[str] = None


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

@router.post("/load-vcf")
async def load_vcf(file: UploadFile = File(...)):
    """Upload a VCF file and perform a quick integrity check.

    Synchronous (no Celery) — parses header, validates with bcftools, counts samples.
    Returns: file_id, valid, sample_count, assembly_detected, reference_line,
             contig_count, file_format, vcf_check_message.
    """
    filename = file.filename or "upload.vcf"
    ext = Path(filename).suffix.lower()
    if ext not in (".vcf", ".gz", ".bcf"):
        raise HTTPException(
            status_code=400,
            detail="Only .vcf, .vcf.gz, and .bcf files are accepted.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    file_id = save_upload(filename, content)

    # Parse VCF header (synchronous, fast)
    try:
        header_info = parse_vcf_header(file_id)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Failed to parse VCF header: {exc}")

    # Count samples from #CHROM line
    sample_count = 0
    try:
        import gzip as _gzip
        opener = _gzip.open if filename.endswith(".gz") else open
        with opener(file_id, "rt", errors="replace") as fh:
            for line in fh:
                if line.startswith("#CHROM"):
                    cols = line.strip().split("\t")
                    sample_count = max(0, len(cols) - 9)
                    break
                if not line.startswith("#"):
                    break
    except Exception:
        sample_count = 0

    # Validate VCF with bcftools
    vcf_check = await run_bcftools_validate(file_id)

    return {
        "file_id": file_id,
        "filename": filename,
        "valid": vcf_check["ok"],
        "vcf_check_message": vcf_check["message"],
        "sample_count": sample_count,
        "assembly_detected": header_info.get("assembly_guess"),
        "reference_line": header_info.get("reference"),
        "contig_count": len(header_info.get("contig_lines", [])),
        "file_format": header_info.get("file_format"),
    }


@router.post("/upload-genotypes")
async def upload_genotypes(
    file: UploadFile = File(...),
    orientation: str = "auto",
    input_type: str = "genotype_matrix",
):
    """Accept a single genotype matrix file and return a preview.

    orientation: 'samples_as_rows' | 'snps_as_rows' | 'auto'
    input_type: 'genotype_matrix' | 'agriplex' | 'dartag'
    """
    filename = file.filename or "upload.txt"
    _check_extension(filename, _GENO_EXTENSIONS)

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        if input_type == "dartag":
            sample_ids, snp_info, matrix = parse_dartag_table(content)
            snp_ids = [s["ID"] for s in snp_info]
        elif input_type == "agriplex":
            sample_ids, snp_info, matrix = parse_agriplex_table(content)
            snp_ids = [s["ID"] for s in snp_info]
        else:
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


@router.post("/upload-header")
async def upload_header_file(file: UploadFile = File(...)):
    """Upload a VCF header file (.txt or .vcf). Returns contig info."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided.")
    ext = Path(file.filename).suffix.lower()
    if ext not in (".txt", ".vcf"):
        raise HTTPException(status_code=400, detail="Only .txt and .vcf header files are accepted.")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    file_id = save_upload(file.filename, content)
    from backend.core.vcf_generator import parse_vcf_header_file
    parsed = parse_vcf_header_file(content)
    return {
        "file_id": file_id,
        "contig_count": len(parsed["contig_ids"]),
        "contig_ids": parsed["contig_ids"],
    }


class ContigCheckRequest(BaseModel):
    header_file_id: str
    snp_file_id: str


@router.post("/check-contigs")
async def check_contigs(body: ContigCheckRequest):
    """Check whether contig IDs in the header file match CHROMs in the SNP info file."""
    header_path = body.header_file_id
    snp_path = body.snp_file_id

    with open(header_path, "rb") as f:
        header_content = f.read()
    with open(snp_path, "rb") as f:
        snp_content = f.read()

    from backend.core.vcf_generator import parse_vcf_header_file, parse_snp_info_table, check_contig_match
    header_parsed = parse_vcf_header_file(header_content)
    snp_info = parse_snp_info_table(snp_content)
    result = check_contig_match(header_parsed["contig_ids"], snp_info)
    return result


@router.post("/generate")
async def generate_vcf(body: GenerateRequest):
    """Submit a VCF generation job.

    Validates both uploaded files exist, creates a Job record,
    and submits the Celery task.
    Returns {job_id, status: 'pending'}.
    """
    if not Path(body.geno_file_id).exists():
        raise HTTPException(status_code=404, detail=f"Genotype file not found: {body.geno_file_id}")
    if body.input_type == "genotype_matrix" and body.snp_file_id and not Path(body.snp_file_id).exists():
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

    header_path = None
    if body.header_file_id and Path(body.header_file_id).exists():
        header_path = body.header_file_id

    task = run_generator_task.delay(
        job_id,
        body.geno_file_id,
        body.snp_file_id or "",
        body.assembly,
        output_path,
        body.orientation,
        body.input_type,
        header_path,
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
