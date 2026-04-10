"""
Celery tasks for VCF processing.

Async core functions are called via asyncio.run() since Celery workers are synchronous.
"""

import asyncio
import json
import uuid
from datetime import datetime

from backend.tasks.celery_app import celery_app
from backend.core.bcftools import run_bcftools_stats, parse_bcftools_stats, run_bcftools_merge
from backend.core.crossmap import run_crossmap_vcf, run_crossmap_bed, parse_crossmap_summary
from backend.core.fixref import run_fixref_check, run_fixref_fix, parse_fixref_stats
from backend.core.file_manager import get_output_path
from backend.core.vcf_generator import (
    parse_genotype_table,
    parse_snp_info_table,
    generate_vcf,
    calculate_missing_pct,
)
from backend.db.models import get_session, Job


def _update_job(job_id: str, **kwargs) -> None:
    """Helper: update job fields in DB."""
    with get_session() as session:
        job = session.get(Job, job_id)
        if job is None:
            return
        for key, value in kwargs.items():
            setattr(job, key, value)
        session.add(job)
        session.commit()


@celery_app.task(bind=True)
def run_stats_task(self, job_id: str, vcf_path: str) -> dict:
    """Run bcftools stats, parse output, update job status in DB.

    Returns the parsed stats dict on success.
    """
    _update_job(job_id, status="running", celery_task_id=self.request.id)

    try:
        stdout, _stderr = asyncio.run(run_bcftools_stats(vcf_path))

        # Save raw stats output
        stats_file_path = get_output_path(job_id, "stats.txt")
        with open(stats_file_path, "w") as f:
            f.write(stdout)

        parsed = asyncio.run(parse_bcftools_stats(stdout))
        result_json = json.dumps(parsed)

        _update_job(
            job_id,
            status="completed",
            output_file=stats_file_path,
            result_json=result_json,
            completed_at=datetime.utcnow(),
        )
        return parsed

    except Exception as exc:
        _update_job(
            job_id,
            status="failed",
            error_message=str(exc),
            completed_at=datetime.utcnow(),
        )
        raise


@celery_app.task(bind=True)
def run_merge_task(
    self,
    job_id: str,
    vcf_paths: list,
    output_path: str,
    norm_multiallelic: bool,
) -> dict:
    """Run bcftools merge, update job status in DB.

    Returns a summary dict on success.
    """
    _update_job(job_id, status="running", celery_task_id=self.request.id)

    try:
        _stdout, stderr = asyncio.run(
            run_bcftools_merge(vcf_paths, output_path, norm_multiallelic)
        )

        # Count warnings in stderr
        warnings = [line for line in stderr.splitlines() if "warning" in line.lower()]

        summary = {
            "output_file": output_path,
            "input_file_count": len(vcf_paths),
            "merge_warnings": len(warnings),
            "warning_messages": warnings[:10],  # cap at 10 for payload size
        }

        result_json = json.dumps(summary)

        _update_job(
            job_id,
            status="completed",
            output_file=output_path,
            result_json=result_json,
            completed_at=datetime.utcnow(),
        )
        return summary

    except Exception as exc:
        _update_job(
            job_id,
            status="failed",
            error_message=str(exc),
            completed_at=datetime.utcnow(),
        )
        raise


@celery_app.task(bind=True)
def run_liftover_task(
    self,
    job_id: str,
    input_path: str,
    chain_path: str,
    input_format: str,
    output_path: str,
) -> dict:
    """Run CrossMap liftover (vcf or bed), update DB, return summary dict."""
    _update_job(job_id, status="running", celery_task_id=self.request.id)

    try:
        if input_format.lower() == "bed":
            _stdout, stderr = asyncio.run(
                run_crossmap_bed(input_path, chain_path, output_path)
            )
        else:
            # Default: VCF (plain or gzipped)
            _stdout, stderr = asyncio.run(
                run_crossmap_vcf(input_path, chain_path, output_path)
            )

        summary = parse_crossmap_summary(stderr)

        # CrossMap writes unmapped entries to <output>.unmap
        unmapped_path = output_path + ".unmap"
        summary["output_file"] = output_path
        summary["unmapped_file"] = unmapped_path

        import os
        if not os.path.exists(unmapped_path):
            summary["unmapped_file"] = None

        result_json = json.dumps(summary)

        _update_job(
            job_id,
            status="completed",
            output_file=output_path,
            result_json=result_json,
            completed_at=datetime.utcnow(),
        )
        return summary

    except Exception as exc:
        _update_job(
            job_id,
            status="failed",
            error_message=str(exc),
            completed_at=datetime.utcnow(),
        )
        raise


@celery_app.task(bind=True)
def run_generator_task(
    self,
    job_id: str,
    geno_path: str,
    snp_info_path: str,
    assembly: str,
    output_path: str,
    orientation: str,
    input_type: str = "genotype_matrix",
    header_file_path: str = None,
) -> dict:
    """Generate a VCF from a dosage matrix, Agriplex, or DArTag file.

    Updates DB. Returns summary dict.
    Result includes: snp_count, sample_count, missing_pct, output_file,
    vcf_valid, vcf_check_message.
    """
    _update_job(job_id, status="running", celery_task_id=self.request.id)

    try:
        with open(geno_path, "rb") as f:
            geno_content = f.read()

        count_mismatch_msg = None

        if input_type == "agriplex":
            from backend.core.vcf_generator import parse_agriplex_table
            sample_ids, snp_info, matrix = parse_agriplex_table(geno_content)
        elif input_type == "dartag":
            from backend.core.vcf_generator import parse_dartag_table
            sample_ids, snp_info, matrix = parse_dartag_table(geno_content)
        else:
            # genotype_matrix: existing logic
            with open(snp_info_path, "rb") as f:
                snp_content = f.read()
            sample_ids, snp_ids, matrix = parse_genotype_table(geno_content, sep="auto")
            snp_info = parse_snp_info_table(snp_content, sep="auto")
            # SNP count alignment (keep existing mismatch check)
            if len(snp_info) != len(snp_ids):
                min_count = min(len(snp_info), len(snp_ids))
                count_mismatch_msg = (
                    f"SNP count mismatch: genotype file has {len(snp_ids)} SNPs, "
                    f"SNP info file has {len(snp_info)}. Using min count."
                )
                snp_info = snp_info[:min_count]
                matrix = [row[:min_count] for row in matrix]

        # Deduplicate sample IDs (VCF requires unique sample names)
        seen: dict = {}
        deduped: list[str] = []
        for sid in sample_ids:
            if sid in seen:
                seen[sid] += 1
                deduped.append(f"{sid}_dup{seen[sid]}")
            else:
                seen[sid] = 0
                deduped.append(sid)
        if len(set(deduped)) != len(sample_ids):
            # Fallback: append index for any remaining duplicates
            deduped = [f"{sid}_{i}" if deduped.count(sid) > 1 else sid
                       for i, sid in enumerate(deduped)]
        sample_ids = deduped

        # Resolve extra header lines from optional header file
        extra_header_lines = None
        if header_file_path:
            from backend.core.vcf_generator import parse_vcf_header_file
            with open(header_file_path, "rb") as f:
                hdr_content = f.read()
            hdr_parsed = parse_vcf_header_file(hdr_content)
            extra_header_lines = hdr_parsed.get("extra_lines")

        # DArTag and Agriplex parsers return pre-translated VCF GT strings
        pre_translated = input_type in ("dartag", "agriplex")

        # Calculate missing percentage before generating VCF
        missing_pct = calculate_missing_pct(sample_ids, snp_info, matrix, pre_translated=pre_translated)

        # Generate VCF string
        vcf_str = generate_vcf(sample_ids, snp_info, matrix, assembly, extra_header_lines, pre_translated=pre_translated)

        # Write to output path
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(vcf_str)

        # bcftools validation
        import asyncio as _asyncio
        from backend.core.bcftools import run_bcftools_validate
        vcf_check = _asyncio.run(run_bcftools_validate(output_path))

        summary: dict = {
            "snp_count": len(snp_info),
            "sample_count": len(sample_ids),
            "missing_pct": missing_pct,
            "output_file": output_path,
            "vcf_valid": vcf_check["ok"],
            "vcf_check_message": vcf_check["message"],
        }
        if input_type == "genotype_matrix" and count_mismatch_msg:
            summary["warning"] = count_mismatch_msg

        result_json = json.dumps(summary)

        _update_job(
            job_id,
            status="completed",
            output_file=output_path,
            result_json=result_json,
            completed_at=datetime.utcnow(),
        )
        return summary

    except Exception as exc:
        _update_job(
            job_id,
            status="failed",
            error_message=str(exc),
            completed_at=datetime.utcnow(),
        )
        raise


@celery_app.task(bind=True)
def run_fixref_fix_task(
    self,
    job_id: str,
    vcf_path: str,
    ref_path: str,
    output_path: str,
) -> dict:
    """Run bcftools +fixref -m flip, collect before/after stats, update DB."""
    _update_job(job_id, status="running", celery_task_id=self.request.id)

    try:
        # Capture before stats via check mode
        before_stdout, before_stderr = asyncio.run(
            run_fixref_check(vcf_path, ref_path)
        )
        before_stats = parse_fixref_stats(before_stdout + "\n" + before_stderr)

        # Run the fix
        _stdout, stderr = asyncio.run(
            run_fixref_fix(vcf_path, ref_path, output_path)
        )

        # Capture after stats via check on the fixed output
        after_stdout, after_stderr = asyncio.run(
            run_fixref_check(output_path, ref_path)
        )
        after_stats = parse_fixref_stats(after_stdout + "\n" + after_stderr)

        summary = {
            "before": before_stats,
            "after": after_stats,
            "output_file": output_path,
        }

        result_json = json.dumps(summary)

        _update_job(
            job_id,
            status="completed",
            output_file=output_path,
            result_json=result_json,
            completed_at=datetime.utcnow(),
        )
        return summary

    except Exception as exc:
        _update_job(
            job_id,
            status="failed",
            error_message=str(exc),
            completed_at=datetime.utcnow(),
        )
        raise
