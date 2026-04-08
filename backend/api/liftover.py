"""
Liftover API router — genome assembly liftover using CrossMap.
"""

import json
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlmodel import select

from backend.core.file_manager import save_upload, get_output_path, UPLOAD_DIR
from backend.db.models import ChainFile, Job, get_session
from backend.tasks.vcf_tasks import run_liftover_task

CHAINS_DIR = "data/chains"

router = APIRouter(prefix="/api/liftover", tags=["liftover"])


# ---------------------------------------------------------------------------
# Request/response models
# ---------------------------------------------------------------------------

class SubmitLiftoverRequest(BaseModel):
    file_id: str
    chain_file_id: str
    input_format: str        # 'vcf' | 'bed'
    output_filename: str


# ---------------------------------------------------------------------------
# Chain file endpoints
# ---------------------------------------------------------------------------

@router.get("/chain-files")
async def list_chain_files():
    """List all registered chain files from the database."""
    with get_session() as session:
        chain_files = session.exec(select(ChainFile)).all()
        return [
            {
                "id": cf.id,
                "name": cf.name,
                "source_assembly": cf.source_assembly,
                "target_assembly": cf.target_assembly,
                "tool_type": cf.tool_type,
                "direction": cf.direction,
                "file_path": cf.file_path,
                "file_exists": Path(cf.file_path).exists(),
                "notes": cf.notes,
                "created_at": cf.created_at.isoformat(),
            }
            for cf in chain_files
        ]


@router.post("/chain-files/upload")
async def upload_chain_file(
    file: UploadFile = File(...),
    name: str = Form(...),
    source_assembly: str = Form(...),
    target_assembly: str = Form(...),
    direction: str = Form(...),
):
    """Upload a .chain file and register it in the database.

    Returns the chain file id.
    """
    if file.filename is None:
        raise HTTPException(status_code=400, detail="No filename provided.")

    filename = file.filename
    if not filename.endswith(".chain"):
        raise HTTPException(
            status_code=400,
            detail="Only .chain files are accepted.",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Save to data/chains/
    Path(CHAINS_DIR).mkdir(parents=True, exist_ok=True)
    unique_name = f"{uuid.uuid4().hex}_{filename}"
    dest = str(Path(CHAINS_DIR) / unique_name)
    with open(dest, "wb") as f:
        f.write(content)

    if direction not in ("fwd", "rev", "both"):
        raise HTTPException(
            status_code=400,
            detail="direction must be 'fwd', 'rev', or 'both'.",
        )

    chain_id = str(uuid.uuid4())
    with get_session() as session:
        chain_file = ChainFile(
            id=chain_id,
            name=name,
            source_assembly=source_assembly,
            target_assembly=target_assembly,
            tool_type="crossmap",
            file_path=dest,
            direction=direction,
        )
        session.add(chain_file)
        session.commit()

    return {"chain_file_id": chain_id, "file_path": dest}


# ---------------------------------------------------------------------------
# Input file upload
# ---------------------------------------------------------------------------

@router.post("/upload")
async def upload_input_file(file: UploadFile = File(...)):
    """Upload a VCF or BED input file for liftover.

    Returns a file_id (the saved path) that must be passed to /submit.
    """
    if file.filename is None:
        raise HTTPException(status_code=400, detail="No filename provided.")

    filename = file.filename
    allowed = (".vcf", ".vcf.gz", ".bed")
    if not any(filename.endswith(ext) for ext in allowed):
        raise HTTPException(
            status_code=400,
            detail="Only .vcf, .vcf.gz, and .bed files are accepted.",
        )

    content = await file.read()
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    saved_path = save_upload(filename, content)
    return {"file_id": saved_path, "filename": filename}


# ---------------------------------------------------------------------------
# Job submission
# ---------------------------------------------------------------------------

@router.post("/submit")
async def submit_liftover(body: SubmitLiftoverRequest):
    """Submit a CrossMap liftover job.

    Returns the job_id for polling.
    """
    # Validate input file
    input_path = body.file_id
    if not Path(input_path).exists():
        raise HTTPException(status_code=404, detail="Input file not found.")

    # Validate chain file
    with get_session() as session:
        chain_file = session.get(ChainFile, body.chain_file_id)
        if chain_file is None:
            raise HTTPException(status_code=404, detail="Chain file not found.")
        chain_path = chain_file.file_path

    if not Path(chain_path).exists():
        raise HTTPException(
            status_code=409,
            detail=(
                f"Chain file does not exist on server at: {chain_path}. "
                "Please place the chain file there before running liftover."
            ),
        )

    if body.input_format not in ("vcf", "bed"):
        raise HTTPException(
            status_code=400,
            detail="input_format must be 'vcf' or 'bed'.",
        )

    # Create output path
    output_path = get_output_path(str(uuid.uuid4()), body.output_filename)

    # Create job record
    job_id = str(uuid.uuid4())
    with get_session() as session:
        job = Job(
            id=job_id,
            module="liftover",
            status="pending",
            input_files=json.dumps([Path(input_path).name]),
            created_at=datetime.utcnow(),
        )
        session.add(job)
        session.commit()

    # Submit Celery task
    task = run_liftover_task.delay(
        job_id,
        input_path,
        chain_path,
        body.input_format,
        output_path,
    )

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
async def get_liftover_status(job_id: str):
    """Return job status and result summary if completed."""
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
            "summary": None,
        }

        if job.status == "completed" and job.result_json:
            result["summary"] = json.loads(job.result_json)

        return result


@router.get("/download/{job_id}")
async def download_liftover_result(job_id: str):
    """Stream the mapped output file."""
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


@router.get("/download-unmapped/{job_id}")
async def download_unmapped(job_id: str):
    """Stream the unmapped entries file if it exists."""
    with get_session() as session:
        job = session.get(Job, job_id)
        if job is None:
            raise HTTPException(status_code=404, detail="Job not found.")
        if job.status != "completed":
            raise HTTPException(
                status_code=409,
                detail=f"Job is not completed (status: {job.status}).",
            )
        if not job.result_json:
            raise HTTPException(status_code=404, detail="No result data found.")

        result = json.loads(job.result_json)
        unmapped_file = result.get("unmapped_file")
        if not unmapped_file or not Path(unmapped_file).exists():
            raise HTTPException(
                status_code=404,
                detail="No unmapped file found (all entries may have mapped).",
            )

        unmapped_path = Path(unmapped_file)
        return FileResponse(
            path=str(unmapped_path),
            media_type="application/octet-stream",
            filename=unmapped_path.name,
        )
