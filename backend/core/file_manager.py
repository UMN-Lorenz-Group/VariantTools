"""
File management utilities for uploads and job outputs.
"""

import os
import uuid
from pathlib import Path

UPLOAD_DIR = "data/uploads"
OUTPUT_DIR = "data/outputs"


def _ensure_dirs() -> None:
    Path(UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    Path(OUTPUT_DIR).mkdir(parents=True, exist_ok=True)


def save_upload(filename: str, content: bytes) -> str:
    """Save uploaded bytes to UPLOAD_DIR with a UUID prefix.

    Returns the full path to the saved file.
    """
    _ensure_dirs()
    unique_name = f"{uuid.uuid4().hex}_{filename}"
    dest = os.path.join(UPLOAD_DIR, unique_name)
    with open(dest, "wb") as f:
        f.write(content)
    return dest


def get_output_path(job_id: str, filename: str) -> str:
    """Return the output file path for a given job."""
    _ensure_dirs()
    return os.path.join(OUTPUT_DIR, f"{job_id}_{filename}")


def cleanup_job(job_id: str) -> None:
    """Remove all output files associated with job_id."""
    output_dir = Path(OUTPUT_DIR)
    if not output_dir.exists():
        return
    for item in output_dir.iterdir():
        if item.name.startswith(f"{job_id}_"):
            try:
                item.unlink()
            except OSError:
                pass
