# VariantTools

A web application for genomic variant processing. Wraps bcftools and CrossMap into a browser-based interface for common VCF workflows.

## Modules

| Module | Description |
|---|---|
| **VCF Stats** | Run `bcftools stats`, visualize substitution types and missing data, detect assembly version |
| **Coordinate Liftover** | Lift over VCF/BED coordinates between assemblies using CrossMap and pre-loaded chain files |
| **Fix Reference** | Check and fix strand issues with `bcftools +fixref -m flip` |
| **Merge VCFs** | Merge 2+ VCFs with optional normalization (`bcftools norm -m +any`) |
| **VCF Generator** | Convert genotype dosage tables (0/1/2) to valid VCF format |

## Quick Start

```bash
git clone https://github.com/UMN-Lorenz-Group/VariantTools.git
cd VariantTools
docker-compose up --build
```

Frontend: http://localhost:3000 | API docs: http://localhost:8000/docs

## Stack

Next.js 14 + FastAPI + Celery/Redis + SQLite — containerized with Docker Compose. Singularity definition included for HPC deployment (`containers/varianttools.def`).

## Chain Files

Place chain files in `data/chains/` before using the Liftover module. No restart required.
