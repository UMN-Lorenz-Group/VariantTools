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

## Reference Scripts

The `Scripts/` directory contains the original lab R workflows that informed this app's data-processing logic.
