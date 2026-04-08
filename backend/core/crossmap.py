"""
Async CrossMap wrapper for genome assembly liftover.
CrossMap must be installed and available on PATH (pip install CrossMap).
"""

import asyncio
import re


async def run_crossmap_vcf(
    vcf_path: str,
    chain_path: str,
    output_path: str,
    ref_genome: str | None = None,
) -> tuple[str, str]:
    """Run CrossMap vcf liftover.

    Command: CrossMap vcf <chain> <input.vcf> [ref.fa] <output.vcf>

    Returns (stdout, stderr).
    Raises RuntimeError if CrossMap is not on PATH or exits with non-zero code.
    """
    cmd: list[str] = ["CrossMap", "vcf", chain_path, vcf_path]
    if ref_genome:
        cmd.append(ref_genome)
    cmd.append(output_path)

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        stdout_str = stdout.decode(errors="replace")
        stderr_str = stderr.decode(errors="replace")

        if proc.returncode != 0:
            raise RuntimeError(
                f"CrossMap vcf failed (exit {proc.returncode}): {stderr_str}"
            )

        return stdout_str, stderr_str

    except FileNotFoundError:
        raise RuntimeError(
            "CrossMap is not installed or not on PATH. "
            "Install it with: pip install CrossMap==0.7.3"
        )


async def run_crossmap_bed(
    bed_path: str,
    chain_path: str,
    output_path: str,
) -> tuple[str, str]:
    """Run CrossMap bed liftover.

    Command: CrossMap bed <chain> <input.bed> <output.bed>

    Returns (stdout, stderr).
    Raises RuntimeError if CrossMap is not on PATH or exits with non-zero code.
    """
    cmd: list[str] = ["CrossMap", "bed", chain_path, bed_path, output_path]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        stdout_str = stdout.decode(errors="replace")
        stderr_str = stderr.decode(errors="replace")

        if proc.returncode != 0:
            raise RuntimeError(
                f"CrossMap bed failed (exit {proc.returncode}): {stderr_str}"
            )

        return stdout_str, stderr_str

    except FileNotFoundError:
        raise RuntimeError(
            "CrossMap is not installed or not on PATH. "
            "Install it with: pip install CrossMap==0.7.3"
        )


def parse_crossmap_summary(stderr: str) -> dict:
    """Parse CrossMap stderr output for mapped/unmapped counts.

    CrossMap writes lines like:
      Total entries:           36163
      Failed to map:           142
      Mapped entries:          36021

    Returns:
      {"total": int, "mapped": int, "unmapped": int, "pct_mapped": float}
    """
    total = 0
    mapped = 0
    unmapped = 0

    # Patterns to match CrossMap summary lines (flexible whitespace)
    total_pattern = re.compile(r"Total entries\s*[:\s]+(\d+)", re.IGNORECASE)
    failed_pattern = re.compile(r"Failed to map\s*[:\s]+(\d+)", re.IGNORECASE)
    mapped_pattern = re.compile(r"Mapped entries\s*[:\s]+(\d+)", re.IGNORECASE)

    for line in stderr.splitlines():
        line = line.strip()

        m = total_pattern.search(line)
        if m:
            total = int(m.group(1))
            continue

        m = failed_pattern.search(line)
        if m:
            unmapped = int(m.group(1))
            continue

        m = mapped_pattern.search(line)
        if m:
            mapped = int(m.group(1))
            continue

    # If total was not explicitly printed, infer it
    if total == 0 and (mapped > 0 or unmapped > 0):
        total = mapped + unmapped

    # If mapped was not explicitly printed, infer it
    if mapped == 0 and total > 0 and unmapped > 0:
        mapped = total - unmapped

    pct_mapped = round((mapped / total * 100), 2) if total > 0 else 0.0

    return {
        "total": total,
        "mapped": mapped,
        "unmapped": unmapped,
        "pct_mapped": pct_mapped,
    }
