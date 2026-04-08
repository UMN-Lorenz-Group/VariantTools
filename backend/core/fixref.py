"""
Async bcftools +fixref wrapper for REF allele mismatch correction.
Requires bcftools with the fixref plugin available on PATH.
"""

import asyncio
import re


async def run_fixref_check(vcf_path: str, ref_fasta_path: str) -> tuple[str, str]:
    """Run bcftools +fixref in check mode (read-only, no output file).

    Command: bcftools +fixref <vcf> -- -f <ref.fa>

    Returns (stdout, stderr).
    Raises RuntimeError on failure or if bcftools is not on PATH.
    """
    cmd: list[str] = [
        "bcftools", "+fixref", vcf_path,
        "--", "-f", ref_fasta_path,
    ]

    try:
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        stdout_str = stdout.decode(errors="replace")
        stderr_str = stderr.decode(errors="replace")

        # bcftools +fixref exits non-zero even when it successfully reports
        # mismatches, so we tolerate a non-zero exit as long as we got output.
        if proc.returncode != 0 and not stdout_str and not stderr_str:
            raise RuntimeError(
                f"bcftools +fixref check failed (exit {proc.returncode}): {stderr_str}"
            )

        return stdout_str, stderr_str

    except FileNotFoundError:
        raise RuntimeError(
            "bcftools is not installed or not on PATH. "
            "Install bcftools (e.g. apt-get install bcftools) and retry."
        )


async def run_fixref_fix(
    vcf_path: str,
    ref_fasta_path: str,
    output_path: str,
) -> tuple[str, str]:
    """Run bcftools +fixref in fix mode with flip/swap correction.

    Command: bcftools +fixref <vcf> -o <output> -- -f <ref.fa> -m flip

    Returns (stdout, stderr).
    Raises RuntimeError on failure or if bcftools is not on PATH.
    """
    cmd: list[str] = [
        "bcftools", "+fixref", vcf_path,
        "-o", output_path,
        "--", "-f", ref_fasta_path, "-m", "flip",
    ]

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
                f"bcftools +fixref fix failed (exit {proc.returncode}): {stderr_str}"
            )

        return stdout_str, stderr_str

    except FileNotFoundError:
        raise RuntimeError(
            "bcftools is not installed or not on PATH. "
            "Install bcftools (e.g. apt-get install bcftools) and retry."
        )


def parse_fixref_stats(stderr: str) -> dict:
    """Parse bcftools +fixref output for reference match/mismatch statistics.

    bcftools +fixref writes summary lines to stderr (and sometimes stdout) in
    two formats depending on version:

    With '#' prefix (newer):
      # SC  strand_flip  0
      # NS  total        36163
      # NS  ref match    36163   100.0%
      # NS  ref mismatch 0       0.0%
      # NS  flipped      0
      # NS  swapped      0
      # NS  flip+swap    0
      # NS  unresolved   0

    Without '#' prefix (older):
      NS  total        36163
      NS  ref match    36163   100.0%
      ...

    Returns:
      {
        "total": int,
        "ref_match": int,
        "ref_match_pct": float,
        "ref_mismatch": int,
        "flipped": int,
        "swapped": int,
        "flip_swap": int,
        "unresolved": int,
      }
    """
    result: dict = {
        "total": 0,
        "ref_match": 0,
        "ref_match_pct": 0.0,
        "ref_mismatch": 0,
        "flipped": 0,
        "swapped": 0,
        "flip_swap": 0,
        "unresolved": 0,
    }

    # Regex: optional '#', then NS, then field name, then integer, then optional pct
    # Examples:
    #   # NS\ttotal\t36163
    #   # NS\tref match\t36163\t100.0%
    #   NS\tflipped\t5
    ns_pattern = re.compile(
        r"^#?\s*NS\s+(\w[\w\s]*?)\s+(\d+)(?:\s+([\d.]+)%)?",
        re.IGNORECASE,
    )

    for line in stderr.splitlines():
        line = line.strip()
        if not line:
            continue

        m = ns_pattern.match(line)
        if not m:
            continue

        field = m.group(1).strip().lower()
        value = int(m.group(2))
        pct_str = m.group(3)

        if field == "total":
            result["total"] = value
        elif "ref match" in field and "mismatch" not in field:
            result["ref_match"] = value
            if pct_str is not None:
                result["ref_match_pct"] = float(pct_str)
        elif "ref mismatch" in field or field == "ref_mismatch":
            result["ref_mismatch"] = value
        elif field == "flipped":
            result["flipped"] = value
        elif field == "swapped":
            result["swapped"] = value
        elif "flip" in field and "swap" in field:
            result["flip_swap"] = value
        elif field == "unresolved":
            result["unresolved"] = value

    # Recalculate pct if not found in output but we have total
    if result["ref_match_pct"] == 0.0 and result["total"] > 0 and result["ref_match"] > 0:
        result["ref_match_pct"] = round(result["ref_match"] / result["total"] * 100, 2)

    return result
