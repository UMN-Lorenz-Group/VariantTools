"""
Core bcftools wrapper module.
All subprocess calls use asyncio.create_subprocess_exec for non-blocking execution.
"""

import asyncio
import re
import os
from pathlib import Path


async def run_bcftools_stats(vcf_path: str) -> tuple[str, str]:
    """Run bcftools stats on a VCF. Returns (stdout, stderr)."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "bcftools", "stats", vcf_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(
                f"bcftools stats failed (exit {proc.returncode}): {stderr.decode()}"
            )
        return stdout.decode(), stderr.decode()
    except FileNotFoundError:
        raise RuntimeError(
            "bcftools is not installed or not on PATH. "
            "Install bcftools (e.g. apt-get install bcftools) and retry."
        )


async def parse_bcftools_stats(stats_output: str) -> dict:
    """Parse bcftools stats text output into a structured dict.

    Extracts:
      SN  — summary numbers (key-value pairs)
      ST  — substitution type counts {type, count, pct}
      PSC — per-sample coverage stats {sample_id, hom_RR, het, hom_AA, missing}

    Returns:
      {"summary": {...}, "substitution_types": [...], "per_sample": [...]}
    """
    summary: dict[str, object] = {}
    substitution_types: list[dict] = []
    per_sample: list[dict] = []

    for line in stats_output.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue

        parts = line.split("\t")
        section = parts[0]

        if section == "SN":
            # SN  0  key:  value
            if len(parts) >= 4:
                key = parts[2].rstrip(":").strip()
                value_str = parts[3].strip()
                try:
                    value: object = int(value_str)
                except ValueError:
                    try:
                        value = float(value_str)
                    except ValueError:
                        value = value_str
                summary[key] = value

        elif section == "ST":
            # ST  0  type  count  pct
            if len(parts) >= 5:
                try:
                    substitution_types.append(
                        {
                            "type": parts[2].strip(),
                            "count": int(parts[3].strip()),
                            "pct": float(parts[4].strip()),
                        }
                    )
                except (ValueError, IndexError):
                    pass

        elif section == "PSC":
            # PSC 0 id  sample  hom_RR  het  hom_AA  ts  tv  indel  missing  ...
            # Column indices (0-based after split):
            #  0=PSC 1=idx 2=id 3=sample 4=hom_RR 5=het 6=hom_AA 7=ts 8=tv 9=indel 10=missing
            if len(parts) >= 11:
                try:
                    per_sample.append(
                        {
                            "sample_id": parts[3].strip(),
                            "hom_RR": int(parts[4].strip()),
                            "het": int(parts[5].strip()),
                            "hom_AA": int(parts[6].strip()),
                            "missing": int(parts[10].strip()),
                        }
                    )
                except (ValueError, IndexError):
                    pass

    return {
        "summary": summary,
        "substitution_types": substitution_types,
        "per_sample": per_sample,
    }


async def run_bcftools_index(vcf_path: str) -> None:
    """Run bcftools index on a VCF file. bgzip first if plain .vcf, then index."""
    path = Path(vcf_path)

    try:
        # If plain VCF, compress with bgzip first
        if path.suffix == ".vcf":
            gz_path = str(path) + ".gz"
            bgzip_proc = await asyncio.create_subprocess_exec(
                "bgzip", "-c", str(path),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            gz_stdout, gz_stderr = await bgzip_proc.communicate()
            if bgzip_proc.returncode != 0:
                raise RuntimeError(f"bgzip failed: {gz_stderr.decode()}")
            with open(gz_path, "wb") as f:
                f.write(gz_stdout)
            vcf_path = gz_path

        proc = await asyncio.create_subprocess_exec(
            "bcftools", "index", vcf_path,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RuntimeError(f"bcftools index failed: {stderr.decode()}")
    except FileNotFoundError:
        raise RuntimeError(
            "bcftools/bgzip is not installed or not on PATH."
        )


async def run_bcftools_merge(
    vcf_paths: list[str],
    output_path: str,
    norm_multiallelic: bool = False,
) -> tuple[str, str]:
    """Run bcftools merge on a list of VCF paths to output_path.

    If norm_multiallelic=True, normalise each file with `bcftools norm -m +any`
    into a temp file before merging.

    Returns (stdout, stderr).
    """
    import tempfile
    import shutil

    if len(vcf_paths) < 2:
        raise ValueError("bcftools merge requires at least 2 input files.")

    try:
        work_paths = vcf_paths

        temp_dir = None
        if norm_multiallelic:
            temp_dir = tempfile.mkdtemp(prefix="bcftools_norm_")
            normalised: list[str] = []
            for vp in vcf_paths:
                base = os.path.basename(vp)
                norm_out = os.path.join(temp_dir, "norm_" + base)
                if not norm_out.endswith(".gz"):
                    norm_out += ".gz"

                norm_proc = await asyncio.create_subprocess_exec(
                    "bcftools", "norm", "-m", "+any", "-O", "z", "-o", norm_out, vp,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                _, norm_stderr = await norm_proc.communicate()
                if norm_proc.returncode != 0:
                    raise RuntimeError(
                        f"bcftools norm failed for {vp}: {norm_stderr.decode()}"
                    )

                # Index normalised file
                idx_proc = await asyncio.create_subprocess_exec(
                    "bcftools", "index", norm_out,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                await idx_proc.communicate()
                normalised.append(norm_out)

            work_paths = normalised

        # Ensure all inputs are indexed
        for vp in work_paths:
            if not (os.path.exists(vp + ".csi") or os.path.exists(vp + ".tbi")):
                await run_bcftools_index(vp)

        merge_proc = await asyncio.create_subprocess_exec(
            "bcftools", "merge", "-O", "z", "-o", output_path, *work_paths,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await merge_proc.communicate()

        if temp_dir:
            shutil.rmtree(temp_dir, ignore_errors=True)

        if merge_proc.returncode != 0:
            raise RuntimeError(
                f"bcftools merge failed (exit {merge_proc.returncode}): {stderr.decode()}"
            )

        return stdout.decode(), stderr.decode()

    except FileNotFoundError:
        raise RuntimeError(
            "bcftools is not installed or not on PATH. "
            "Install bcftools and retry."
        )


# ---------------------------------------------------------------------------
# Known assembly patterns for header scanning
# ---------------------------------------------------------------------------
_ASSEMBLY_PATTERNS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"GRCh38|hg38", re.IGNORECASE), "GRCh38/hg38"),
    (re.compile(r"GRCh37|hg19", re.IGNORECASE), "GRCh37/hg19"),
    (re.compile(r"Wm82\.a6|soybean.*a6|a6", re.IGNORECASE), "Wm82.a6"),
    (re.compile(r"Wm82\.a4|soybean.*a4|a4", re.IGNORECASE), "Wm82.a4"),
    (re.compile(r"Wm82\.a2|soybean.*a2|a2", re.IGNORECASE), "Wm82.a2"),
    (re.compile(r"Wm82\.a1|soybean.*a1|a1", re.IGNORECASE), "Wm82.a1"),
    (re.compile(r"Wm82", re.IGNORECASE), "Wm82"),
    (re.compile(r"B73", re.IGNORECASE), "B73 (Maize)"),
    (re.compile(r"T2T|CHM13", re.IGNORECASE), "T2T-CHM13"),
    (re.compile(r"mm10|GRCm38", re.IGNORECASE), "GRCm38/mm10"),
    (re.compile(r"mm39|GRCm39", re.IGNORECASE), "GRCm39/mm39"),
]


def parse_vcf_header(vcf_path: str) -> dict:
    """Read VCF header lines from file and extract assembly metadata.

    Returns:
        {
            "reference": str | None,
            "contig_lines": list[str],
            "file_format": str | None,
            "assembly_guess": str | None,
        }
    """
    reference: str | None = None
    contig_lines: list[str] = []
    file_format: str | None = None

    opener = None
    if vcf_path.endswith(".gz"):
        import gzip
        opener = gzip.open(vcf_path, "rt", encoding="utf-8", errors="replace")
    else:
        opener = open(vcf_path, "r", encoding="utf-8", errors="replace")

    with opener as fh:
        for raw_line in fh:
            line = raw_line.rstrip("\n")
            if not line.startswith("#"):
                break
            if line.startswith("##fileformat="):
                file_format = line.split("=", 1)[1]
            elif line.startswith("##reference="):
                reference = line.split("=", 1)[1]
            elif line.startswith("##contig="):
                contig_lines.append(line)

    # Guess assembly from reference field and contig lines
    assembly_guess: str | None = None
    search_text = " ".join(
        filter(None, [reference] + contig_lines)
    )

    for pattern, name in _ASSEMBLY_PATTERNS:
        if pattern.search(search_text):
            assembly_guess = name
            break

    return {
        "reference": reference,
        "contig_lines": contig_lines,
        "file_format": file_format,
        "assembly_guess": assembly_guess,
    }
