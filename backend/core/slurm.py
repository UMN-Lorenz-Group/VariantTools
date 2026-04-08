"""
SLURM integration helpers for VariantTools.

Generates ready-to-submit SLURM batch scripts for MSI (Minnesota Supercomputing Institute).
No SSH submission — scripts are downloaded and submitted by the user with `sbatch`.
"""

import os
from datetime import datetime
from pathlib import Path

# ---------------------------------------------------------------------------
# Environment configuration
# ---------------------------------------------------------------------------

SLURM_ENABLED: bool = os.environ.get("SLURM_ENABLED", "false").lower() == "true"
SLURM_HOST: str = os.environ.get("SLURM_HOST", "login.msi.umn.edu")
SLURM_USER: str = os.environ.get("SLURM_USER", "")
SLURM_WORK_DIR: str = os.environ.get(
    "SLURM_WORK_DIR", "/scratch.global/$USER/varianttools"
)
SLURM_PARTITION: str = os.environ.get("SLURM_PARTITION", "amdsmall")
SLURM_ACCOUNT: str = os.environ.get("SLURM_ACCOUNT", "")


# ---------------------------------------------------------------------------
# Script builder
# ---------------------------------------------------------------------------

def generate_slurm_script(
    job_name: str,
    module: str,
    commands: list[str],
    cpus: int = 4,
    mem_gb: int = 16,
    time_hours: int = 4,
    output_dir: str = "",
) -> str:
    """Generate a SLURM batch script string.

    Args:
        job_name:   SBATCH job name.
        module:     'merge' | 'liftover' | 'fixref' | 'generator'
        commands:   Shell commands to include in the script body.
        cpus:       CPUs per task (--cpus-per-task).
        mem_gb:     Memory in GB (--mem).
        time_hours: Walltime in hours (--time).
        output_dir: Directory for SLURM log output. Defaults to SLURM_WORK_DIR.

    Returns the full script text starting with #!/bin/bash.
    """
    if not output_dir:
        output_dir = SLURM_WORK_DIR

    time_str = f"{time_hours:02d}:00:00"
    mem_str = f"{mem_gb}gb"

    account_line = f"#SBATCH --account={SLURM_ACCOUNT}" if SLURM_ACCOUNT else "# #SBATCH --account=<your_account>"
    log_path = f"{output_dir}/logs/{job_name}_%j.out"

    # Module loads vary by workflow
    module_loads: list[str] = []
    if module in ("merge", "fixref", "generator"):
        module_loads.append("module load bcftools")
    if module == "liftover":
        module_loads.append("module load crossmap/0.7.3")

    module_block = "\n".join(module_loads) if module_loads else "# No additional modules required"

    commands_block = "\n".join(commands)

    script = f"""#!/bin/bash
# VariantTools SLURM batch script
# Module:    {module}
# Generated: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S UTC')}
# Submit:    sbatch {job_name}.sh
#
# MSI usage:
#   1. Copy this file to MSI: scp {job_name}.sh {SLURM_USER or '<user>'}@{SLURM_HOST}:{SLURM_WORK_DIR}/
#   2. SSH to MSI: ssh {SLURM_USER or '<user>'}@{SLURM_HOST}
#   3. Submit: sbatch {SLURM_WORK_DIR}/{job_name}.sh

#SBATCH --job-name={job_name}
#SBATCH --partition={SLURM_PARTITION}
{account_line}
#SBATCH --cpus-per-task={cpus}
#SBATCH --mem={mem_str}
#SBATCH --time={time_str}
#SBATCH --output={log_path}
#SBATCH --error={log_path}

set -euo pipefail

echo "=== VariantTools: {module} job ==="
echo "Started: $(date)"
echo "Host:    $(hostname)"
echo ""

# Load required modules
{module_block}

# Ensure working directory exists
mkdir -p {SLURM_WORK_DIR}
mkdir -p {output_dir}/logs
cd {SLURM_WORK_DIR}

# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------
{commands_block}

echo ""
echo "=== Completed: $(date) ==="
"""
    return script


# ---------------------------------------------------------------------------
# Module-specific script generators
# ---------------------------------------------------------------------------

def get_slurm_script_for_merge(
    vcf_paths: list[str],
    output_path: str,
    norm_multiallelic: bool,
) -> str:
    """Generate a complete SLURM script for bcftools merge.

    Mirrors the exact bcftools commands used in the interactive workflow
    (see Gencove_Subsets_6K_50K_bcfTools.txt).
    """
    commands: list[str] = []

    if norm_multiallelic:
        # Normalize each file with bcftools norm -m +any before merging
        norm_paths: list[str] = []
        for vp in vcf_paths:
            base = Path(vp).stem.replace(".vcf", "")
            norm_out = f"{SLURM_WORK_DIR}/norm_{base}.vcf.gz"
            commands.append(
                f"echo 'Normalizing {Path(vp).name}...'"
            )
            commands.append(
                f"bcftools norm -m +any -O z -o {norm_out} {vp}"
            )
            commands.append(f"bcftools index {norm_out}")
            norm_paths.append(norm_out)

        merge_inputs = " ".join(norm_paths)
        commands.append(f"\necho 'Indexing input files...'")
        for vp in vcf_paths:
            commands.append(f"bcftools index {vp} 2>/dev/null || true")
        commands.append(f"\necho 'Merging normalized VCFs...'")
        commands.append(
            f"bcftools merge -O z -o {output_path} {merge_inputs}"
        )
    else:
        # Index all inputs first, then merge
        commands.append("echo 'Indexing input files...'")
        for vp in vcf_paths:
            commands.append(f"bcftools index {vp} 2>/dev/null || true")
        commands.append("\necho 'Merging VCFs...'")
        commands.append(
            f"bcftools merge -O z -o {output_path} {' '.join(vcf_paths)}"
        )

    commands.append(f"\necho 'Output written to: {output_path}'")
    commands.append(f"bcftools stats {output_path} | grep '^SN'")

    n_files = len(vcf_paths)
    return generate_slurm_script(
        job_name="varianttools_merge",
        module="merge",
        commands=commands,
        cpus=4,
        mem_gb=16,
        time_hours=4,
    )


def get_slurm_script_for_liftover(
    input_path: str,
    chain_path: str,
    output_path: str,
    input_format: str,
) -> str:
    """Generate a complete SLURM script for CrossMap liftover.

    Mirrors the CrossMap commands from Liftover_a4_to_a6.txt.
    """
    fmt = input_format.lower()
    commands: list[str] = []

    if fmt == "bed":
        commands.append(f"echo 'Running CrossMap BED liftover...'")
        commands.append(
            f"CrossMap bed {chain_path} {input_path} | grep -v 'Unmap' > {output_path}"
        )
    else:
        # VCF (plain or gzipped)
        commands.append(f"echo 'Running CrossMap VCF liftover...'")
        commands.append(
            f"CrossMap vcf {chain_path} {input_path} {output_path}"
        )

    commands.append(f"\necho 'Output written to: {output_path}'")

    return generate_slurm_script(
        job_name="varianttools_liftover",
        module="liftover",
        commands=commands,
        cpus=2,
        mem_gb=8,
        time_hours=2,
    )


def get_slurm_script_for_fixref(
    vcf_path: str,
    ref_path: str,
    output_path: str,
) -> str:
    """Generate a complete SLURM script for bcftools +fixref."""
    commands = [
        f"echo 'Checking REF mismatches before fix...'",
        f"bcftools +fixref {vcf_path} -- -f {ref_path} 2>&1 | tail -20",
        f"\necho 'Applying +fixref flip correction...'",
        f"bcftools +fixref {vcf_path} -O z -o {output_path} -- -f {ref_path} -m flip",
        f"\necho 'Checking after fix...'",
        f"bcftools +fixref {output_path} -- -f {ref_path} 2>&1 | tail -20",
        f"\necho 'Output written to: {output_path}'",
    ]

    return generate_slurm_script(
        job_name="varianttools_fixref",
        module="fixref",
        commands=commands,
        cpus=4,
        mem_gb=16,
        time_hours=4,
    )
