"""
SLURM API router — Phase 3.

Generates and returns SLURM batch scripts for download.
No SSH submission; users run `sbatch script.sh` themselves on MSI.
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import PlainTextResponse

from backend.core.slurm import (
    SLURM_ENABLED,
    SLURM_HOST,
    SLURM_PARTITION,
    SLURM_USER,
    SLURM_WORK_DIR,
    get_slurm_script_for_fixref,
    get_slurm_script_for_liftover,
    get_slurm_script_for_merge,
)
from backend.db.models import ChainFile, Job, get_session

router = APIRouter(prefix="/api/slurm", tags=["slurm"])


# ---------------------------------------------------------------------------
# Status
# ---------------------------------------------------------------------------

@router.get("/status")
async def slurm_status():
    """Return current SLURM configuration status."""
    return {
        "enabled": SLURM_ENABLED,
        "host": SLURM_HOST,
        "user": SLURM_USER,
        "work_dir": SLURM_WORK_DIR,
        "partition": SLURM_PARTITION,
    }


# ---------------------------------------------------------------------------
# Script: merge
# ---------------------------------------------------------------------------

@router.get("/script/merge", response_class=PlainTextResponse)
async def script_merge(
    file_ids: str = Query(..., description="Comma-separated file paths/IDs"),
    norm_multiallelic: bool = Query(False),
    output_filename: str = Query("merged.vcf.gz"),
):
    """Generate and return a SLURM script for bcftools merge as a text/plain download."""
    ids = [fid.strip() for fid in file_ids.split(",") if fid.strip()]
    if len(ids) < 2:
        raise HTTPException(
            status_code=400, detail="At least 2 file_ids are required for merge."
        )

    output_path = f"{SLURM_WORK_DIR}/{output_filename}"
    script = get_slurm_script_for_merge(ids, output_path, norm_multiallelic)

    return PlainTextResponse(
        content=script,
        headers={
            "Content-Disposition": "attachment; filename=varianttools_merge.sh"
        },
    )


# ---------------------------------------------------------------------------
# Script: liftover
# ---------------------------------------------------------------------------

@router.get("/script/liftover", response_class=PlainTextResponse)
async def script_liftover(
    chain_file_id: str = Query(..., description="ChainFile DB record ID"),
    input_file_id: str = Query(..., description="Path to uploaded input file"),
    input_format: str = Query("vcf", description="'vcf' or 'bed'"),
    output_filename: str = Query("liftover_output.vcf"),
):
    """Generate and return a SLURM script for CrossMap liftover."""
    with get_session() as session:
        chain = session.get(ChainFile, chain_file_id)
        if chain is None:
            raise HTTPException(
                status_code=404, detail=f"Chain file not found: {chain_file_id}"
            )

    if not Path(input_file_id).exists():
        raise HTTPException(
            status_code=404, detail=f"Input file not found: {input_file_id}"
        )

    output_path = f"{SLURM_WORK_DIR}/{output_filename}"
    script = get_slurm_script_for_liftover(
        input_path=input_file_id,
        chain_path=chain.file_path,
        output_path=output_path,
        input_format=input_format,
    )

    return PlainTextResponse(
        content=script,
        headers={
            "Content-Disposition": "attachment; filename=varianttools_liftover.sh"
        },
    )


# ---------------------------------------------------------------------------
# Script: fixref
# ---------------------------------------------------------------------------

@router.get("/script/fixref", response_class=PlainTextResponse)
async def script_fixref(
    vcf_file_id: str = Query(..., description="Path to uploaded VCF file"),
    ref_path: str = Query(..., description="Absolute path to reference FASTA on HPC"),
    output_filename: str = Query("fixref_output.vcf.gz"),
):
    """Generate and return a SLURM script for bcftools +fixref."""
    if not Path(vcf_file_id).exists():
        raise HTTPException(
            status_code=404, detail=f"VCF file not found: {vcf_file_id}"
        )

    output_path = f"{SLURM_WORK_DIR}/{output_filename}"
    script = get_slurm_script_for_fixref(
        vcf_path=vcf_file_id,
        ref_path=ref_path,
        output_path=output_path,
    )

    return PlainTextResponse(
        content=script,
        headers={
            "Content-Disposition": "attachment; filename=varianttools_fixref.sh"
        },
    )
