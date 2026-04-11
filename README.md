# VariantTools

A web application for genomic variant processing. Wraps bcftools and CrossMap into a browser-based pipeline for common VCF QC and preparation workflows.

## Pipeline

Modules are designed to be run in order. A **Pipeline VCF** banner persists your active file across steps so you don't have to re-upload between modules.

| Step | Module | Description |
|---|---|---|
| 1 | **Load / Generate VCF** | Load an existing VCF and check integrity with `bcftools`, or generate a new VCF from DArTag, Agriplex, or dosage matrix (0/1/2) genotype data. Supports a separate VCF header file input. |
| 2 | **Stats & Assembly** | Detect reference assembly, run `bcftools stats`, visualize substitution types, SNP/indel counts, and per-sample missing data rates. |
| 3 | **Fix Reference** | Fix REF allele mismatches against a reference FASTA using `bcftools +fixref`. Compare before/after mismatch rates. |
| 4 | **Liftover** | Lift over variants between genome assemblies using CrossMap chain files. View mapped/unmapped counts and download results. |
| 5 | **Merge VCFs** | Merge 2+ VCFs with optional normalization (`bcftools norm -m +any`). |

## Quick Start

```bash
git clone https://github.com/UMN-Lorenz-Group/VariantTools.git
cd VariantTools
docker-compose up --build
```

Frontend: http://localhost:3000 | API docs: http://localhost:8000/docs

## Stack

Next.js 14 + FastAPI + Celery/Redis + SQLite — containerized with Docker Compose. Singularity definition included for HPC deployment (`containers/varianttools.def`).

## Input Formats (Load / Generate VCF)

| Format | Description |
|---|---|
| VCF / VCF.GZ | Load directly; bcftools integrity check runs automatically |
| Dosage matrix | Tab-separated genotype table with 0/1/2 dosage values |
| Agriplex table | Agriplex SNP array export format |
| DArTag table | DArTag genotyping export format |

## Chain Files

Place chain files in `data/chains/` before using the Liftover module. No restart required.

## HPC Deployment (MSI / Singularity)

The backend API and Celery worker run inside a Singularity container. The frontend is served separately as a static Next.js export or via `npm run dev` on a compute node with port forwarding.

### 1. Build the container

```bash
# On MSI login node (or interactive job)
cd VariantTools
singularity build containers/varianttools.sif containers/varianttools.def
```

### 2. Start Redis

```bash
singularity exec docker://redis:7-alpine redis-server --daemonize yes
export REDIS_URL=redis://localhost:6379/0
```

### 3. Start the API server

```bash
singularity run \
  --bind ./data:/app/data \
  --bind ./backend:/app/backend \
  containers/varianttools.sif
# Serves FastAPI on port 8000
```

### 4. Start the Celery worker (separate terminal / job step)

```bash
singularity exec \
  --bind ./data:/app/data \
  --bind ./backend:/app/backend \
  containers/varianttools.sif \
  celery -A backend.tasks.celery_app worker --loglevel=info --concurrency=2
```

### 5. Start the frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
# Serves Next.js on port 3000
```

### 6. Access via SSH tunnel (from your laptop)

```bash
ssh -L 3000:localhost:3000 -L 8000:localhost:8000 <user>@login.msi.umn.edu
```

Then open http://localhost:3000 in your browser.

### Environment variables

| Variable | Default | Description |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection string |
| `SLURM_ENABLED` | `false` | Enable SLURM script generation |
| `SLURM_HOST` | `login.msi.umn.edu` | MSI login node |
| `SLURM_USER` | _(unset)_ | Your MSI username |
| `SLURM_WORK_DIR` | `/scratch.global/$USER/varianttools` | Scratch working directory |
| `SLURM_PARTITION` | `amdsmall` | SLURM partition |
| `SLURM_ACCOUNT` | _(unset)_ | SLURM account (if required) |

Set these before running `singularity run` or export them in your SLURM job script.

### Example SLURM job script

```bash
#!/bin/bash
#SBATCH --job-name=varianttools
#SBATCH --partition=amdsmall
#SBATCH --time=08:00:00
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=4
#SBATCH --mem=16G

cd $SLURM_SUBMIT_DIR
export REDIS_URL=redis://localhost:6379/0
export SLURM_ENABLED=true
export SLURM_USER=$USER

# Redis
singularity exec docker://redis:7-alpine redis-server --daemonize yes

# Celery worker (background)
singularity exec --bind ./data:/app/data --bind ./backend:/app/backend \
  containers/varianttools.sif \
  celery -A backend.tasks.celery_app worker --loglevel=info --concurrency=2 &

# API server (foreground)
singularity run --bind ./data:/app/data --bind ./backend:/app/backend \
  containers/varianttools.sif
```

## Reference Scripts

The `Scripts/` directory contains the original lab R workflows that informed this app's data-processing logic.
