"""
VCF Generator core logic.

Ports the R genotype-to-VCF workflow from AGP_PYT_2025_MasterSet_GenoData_Prep.R.
All functions are synchronous — safe to call directly from Celery tasks.
"""

import re
from datetime import date
from typing import Optional


# ---------------------------------------------------------------------------
# Dosage translation
# ---------------------------------------------------------------------------

_MISSING_VALUES = {"na", "nan", "", ".", "./.", "n/a", "none", "null"}


def translate_dosage(val: str) -> str:
    """Translate a single dosage value to VCF GT format.

    '0' -> '0/0'
    '1' -> '0/1'
    '2' -> '1/1'
    NA/NaN/empty/missing -> './.'
    Any other value -> './.'
    """
    stripped = val.strip()
    if stripped.lower() in _MISSING_VALUES:
        return "./."
    if stripped == "0":
        return "0/0"
    if stripped == "1":
        return "0/1"
    if stripped == "2":
        return "1/1"
    return "./."


# ---------------------------------------------------------------------------
# Separator detection
# ---------------------------------------------------------------------------

def _detect_sep(line: str) -> str:
    """Detect separator for a line: tab > comma > space."""
    if "\t" in line:
        return "\t"
    if "," in line:
        return ","
    return " "


# ---------------------------------------------------------------------------
# Genotype matrix parsing
# ---------------------------------------------------------------------------

def parse_genotype_table(
    content: bytes,
    sep: str = "auto",
) -> tuple[list[str], list[str], list[list[str]]]:
    """Parse a genotype matrix from bytes content.

    Supports two orientations (auto-detect):
      - samples_as_rows: rows=samples, cols=SNPs (first col=sample_id, rest=dosage)
      - snps_as_rows:    rows=SNPs, cols=samples (first col=SNP_id, rest=dosage)

    Auto-detection heuristic: if first-column values in data rows look like dosage
    values (0/1/2/NA), we assume snps_as_rows; otherwise samples_as_rows.

    sep='auto' tries tab, then comma, then space.

    Returns (sample_ids, snp_ids, matrix) where
      matrix[sample_idx][snp_idx] is the raw dosage string.
    """
    text = content.decode("utf-8", errors="replace")
    lines = [ln for ln in text.splitlines() if ln.strip()]
    if not lines:
        raise ValueError("Genotype file is empty.")

    # Determine separator
    actual_sep = sep
    if sep == "auto":
        actual_sep = _detect_sep(lines[0])

    def split_line(ln: str) -> list[str]:
        return ln.split(actual_sep)

    header = split_line(lines[0])
    data_lines = lines[1:]

    if not data_lines:
        raise ValueError("Genotype file has a header but no data rows.")

    # Auto-detect orientation: look at first cell of first data row
    first_data_row = split_line(data_lines[0])
    first_col_val = first_data_row[0].strip().lower() if first_data_row else ""
    first_header_val = header[0].strip().lower() if header else ""

    # If first column values are dosage-like (0,1,2,na,nan) => snps_as_rows
    dosage_like = first_col_val in {"0", "1", "2", "na", "nan", "", "."}
    # Also check header first cell — if it looks like a chromosome or SNP name => snps_as_rows
    snp_name_pattern = re.compile(
        r"^(gm|chr|scaffold|contig|un|\d)", re.IGNORECASE
    )
    header_looks_like_snp = bool(snp_name_pattern.match(first_header_val)) if first_header_val else False

    if dosage_like or header_looks_like_snp:
        # snps_as_rows: header[0] = SNP_id column name, header[1:] = sample IDs
        sample_ids: list[str] = [h.strip() for h in header[1:]]
        snp_ids: list[str] = []
        # matrix[sample_idx][snp_idx]
        # Build as [snp_idx][sample_idx] first, then transpose
        cols_per_snp: list[list[str]] = []
        for ln in data_lines:
            parts = split_line(ln)
            if not parts or all(p.strip() == "" for p in parts):
                continue
            snp_id = parts[0].strip()
            snp_ids.append(snp_id)
            dosage_vals = [p.strip() for p in parts[1:]]
            # Pad or trim to number of samples
            while len(dosage_vals) < len(sample_ids):
                dosage_vals.append("")
            dosage_vals = dosage_vals[: len(sample_ids)]
            cols_per_snp.append(dosage_vals)

        if not snp_ids:
            raise ValueError("No SNP rows found in genotype file (snps_as_rows mode).")

        # Transpose: matrix[sample_idx][snp_idx]
        n_samples = len(sample_ids)
        n_snps = len(snp_ids)
        matrix: list[list[str]] = [
            [cols_per_snp[snp_idx][sample_idx] for snp_idx in range(n_snps)]
            for sample_idx in range(n_samples)
        ]
        return sample_ids, snp_ids, matrix

    else:
        # samples_as_rows: header[0] = sample_id col name, header[1:] = SNP IDs
        snp_ids = [h.strip() for h in header[1:]]
        sample_ids = []
        matrix = []
        for ln in data_lines:
            parts = split_line(ln)
            if not parts or all(p.strip() == "" for p in parts):
                continue
            sample_id = parts[0].strip()
            sample_ids.append(sample_id)
            dosage_vals = [p.strip() for p in parts[1:]]
            while len(dosage_vals) < len(snp_ids):
                dosage_vals.append("")
            dosage_vals = dosage_vals[: len(snp_ids)]
            matrix.append(dosage_vals)

        if not sample_ids:
            raise ValueError("No sample rows found in genotype file (samples_as_rows mode).")

        return sample_ids, snp_ids, matrix


# ---------------------------------------------------------------------------
# SNP info table parsing
# ---------------------------------------------------------------------------

# Column name aliases (lower-case key -> canonical VCF field)
_CHROM_ALIASES = {"chrom", "chr", "chromosome", "#chrom"}
_POS_ALIASES = {"pos", "position", "bp", "start"}
_REF_ALIASES = {"ref", "reference", "ref_allele"}
_ALT_ALIASES = {"alt", "alternate", "alt_allele", "allele"}
_ID_ALIASES = {"id", "snp_id", "snpid", "marker", "name", "variant_id", "rsid"}
_QUAL_ALIASES = {"qual", "quality"}
_FILTER_ALIASES = {"filter"}
_INFO_ALIASES = {"info"}
_FORMAT_ALIASES = {"format"}


def _match_col(col_name: str, aliases: set[str]) -> bool:
    return col_name.strip().lower() in aliases


def parse_snp_info_table(
    content: bytes,
    sep: str = "auto",
) -> list[dict]:
    """Parse SNP metadata table.

    Expected columns (flexible order, case-insensitive):
      CHROM/CHR, POS/position, REF, ALT
      Optional: ID, QUAL, FILTER, INFO, FORMAT

    Falls back: if only 2 columns, treat as CHROM + POS.

    Returns list of dicts sorted by CHROM, POS:
      [{"CHROM": str, "POS": int, "ID": str, "REF": str, "ALT": str}, ...]
    """
    text = content.decode("utf-8", errors="replace")
    lines = [ln for ln in text.splitlines() if ln.strip() and not ln.startswith("##")]
    if not lines:
        raise ValueError("SNP info file is empty.")

    actual_sep = sep
    if sep == "auto":
        actual_sep = _detect_sep(lines[0])

    def split_line(ln: str) -> list[str]:
        return [c.strip() for c in ln.split(actual_sep)]

    header_parts = split_line(lines[0])
    data_lines = lines[1:]

    # Map column names to indices
    chrom_idx: Optional[int] = None
    pos_idx: Optional[int] = None
    ref_idx: Optional[int] = None
    alt_idx: Optional[int] = None
    id_idx: Optional[int] = None
    qual_idx: Optional[int] = None
    filter_idx: Optional[int] = None
    info_idx: Optional[int] = None

    for i, col in enumerate(header_parts):
        cl = col.lower()
        if cl in _CHROM_ALIASES:
            chrom_idx = i
        elif cl in _POS_ALIASES:
            pos_idx = i
        elif cl in _REF_ALIASES:
            ref_idx = i
        elif cl in _ALT_ALIASES:
            alt_idx = i
        elif cl in _ID_ALIASES:
            id_idx = i
        elif cl in _QUAL_ALIASES:
            qual_idx = i
        elif cl in _FILTER_ALIASES:
            filter_idx = i
        elif cl in _INFO_ALIASES:
            info_idx = i

    # Fallback: only 2 columns => CHROM + POS
    if chrom_idx is None and pos_idx is None and len(header_parts) == 2:
        chrom_idx = 0
        pos_idx = 1

    if chrom_idx is None:
        raise ValueError(
            "SNP info file must have a CHROM/CHR column. "
            f"Found columns: {header_parts}"
        )
    if pos_idx is None:
        raise ValueError(
            "SNP info file must have a POS/position column. "
            f"Found columns: {header_parts}"
        )

    records: list[dict] = []
    for ln in data_lines:
        parts = split_line(ln)
        if not parts or all(p == "" for p in parts):
            continue
        # Safe get
        def get(idx: Optional[int], default: str = ".") -> str:
            if idx is None or idx >= len(parts):
                return default
            v = parts[idx].strip()
            return v if v else default

        chrom = get(chrom_idx, ".")
        pos_str = get(pos_idx, "0")
        try:
            pos = int(float(pos_str))
        except (ValueError, TypeError):
            pos = 0

        ref = get(ref_idx, ".")
        alt = get(alt_idx, ".")
        snp_id = get(id_idx, f"{chrom}-{pos}")
        if snp_id == "." or snp_id == "":
            snp_id = f"{chrom}-{pos}"

        records.append(
            {
                "CHROM": chrom,
                "POS": pos,
                "ID": snp_id,
                "REF": ref,
                "ALT": alt,
                "QUAL": get(qual_idx, "."),
                "FILTER": get(filter_idx, "."),
                "INFO": get(info_idx, "."),
            }
        )

    if not records:
        raise ValueError("No SNP records found in SNP info file.")

    # Natural sort by CHROM then POS
    records.sort(key=lambda r: (_natural_chrom_key(r["CHROM"]), r["POS"]))
    return records


def _natural_chrom_key(chrom: str) -> tuple:
    """Natural sort key for chromosome names.

    Gm01 < Gm02 < ... < Gm20
    chr1 < chr2 < ... < chr22
    1 < 2 < ... < 22 < X < Y
    """
    # Strip common prefixes for sorting
    stripped = re.sub(r"^(chr|gm|chrom|chromosome)", "", chrom, flags=re.IGNORECASE)
    # Try numeric
    try:
        return (0, int(stripped), "")
    except ValueError:
        # Mixed: e.g. "X", "Y", "MT"
        return (1, 0, stripped.lower())


# ---------------------------------------------------------------------------
# VCF header builder
# ---------------------------------------------------------------------------

def build_vcf_header(
    assembly: str,
    sample_ids: list[str],
    snp_info: list[dict],
) -> str:
    """Build VCF v4.3 header string.

    Includes fileformat, fileDate, source, reference, FORMAT GT meta-line,
    and the #CHROM column header line.

    Returns the full header as a single string with newlines.
    """
    today = date.today().strftime("%Y%m%d")
    lines = [
        "##fileformat=VCFv4.3",
        f"##fileDate={today}",
        "##source=VariantTools v0.3.0",
        f"##reference={assembly}",
        '##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">',
    ]
    # Column header
    col_header = "\t".join(
        ["#CHROM", "POS", "ID", "REF", "ALT", "QUAL", "FILTER", "INFO", "FORMAT"]
        + sample_ids
    )
    lines.append(col_header)
    return "\n".join(lines) + "\n"


# ---------------------------------------------------------------------------
# Dimension validation
# ---------------------------------------------------------------------------

def validate_dimensions(
    sample_ids: list[str],
    snp_info: list[dict],
    matrix: list[list[str]],
) -> None:
    """Validate that matrix dimensions match sample_ids and snp_info lengths.

    Raises ValueError with a descriptive message if they don't match.
    """
    n_samples = len(sample_ids)
    n_snps = len(snp_info)

    if len(matrix) != n_samples:
        raise ValueError(
            f"Matrix has {len(matrix)} rows but {n_samples} sample IDs were provided. "
            "Ensure the genotype file orientation is correct."
        )

    for i, row in enumerate(matrix):
        if len(row) != n_snps:
            raise ValueError(
                f"Matrix row {i} (sample '{sample_ids[i]}') has {len(row)} values "
                f"but {n_snps} SNPs are expected. "
                "Ensure the SNP info file matches the genotype file."
            )


# ---------------------------------------------------------------------------
# VCF generator
# ---------------------------------------------------------------------------

def generate_vcf(
    sample_ids: list[str],
    snp_info: list[dict],
    matrix: list[list[str]],
    assembly: str,
) -> str:
    """Generate a complete VCF string (header + data rows).

    For each SNP in snp_info (in order):
      CHROM POS ID REF ALT QUAL=. FILTER=. INFO=. FORMAT=GT <GT per sample>

    matrix[sample_idx][snp_idx] = raw dosage string.

    Returns the complete VCF as a string.
    """
    validate_dimensions(sample_ids, snp_info, matrix)

    header = build_vcf_header(assembly, sample_ids, snp_info)
    rows: list[str] = []

    n_samples = len(sample_ids)

    for snp_idx, snp in enumerate(snp_info):
        gt_calls = [
            translate_dosage(matrix[sample_idx][snp_idx])
            for sample_idx in range(n_samples)
        ]
        row = "\t".join(
            [
                str(snp["CHROM"]),
                str(snp["POS"]),
                str(snp["ID"]),
                str(snp.get("REF", ".")),
                str(snp.get("ALT", ".")),
                str(snp.get("QUAL", ".")),
                str(snp.get("FILTER", ".")),
                str(snp.get("INFO", ".")),
                "GT",
            ]
            + gt_calls
        )
        rows.append(row)

    return header + "\n".join(rows) + ("\n" if rows else "")


# ---------------------------------------------------------------------------
# Missing percent calculation
# ---------------------------------------------------------------------------

def calculate_missing_pct(
    sample_ids: list[str],
    snp_info: list[dict],
    matrix: list[list[str]],
) -> float:
    """Return fraction of cells that translate to './.' (missing genotype)."""
    n_samples = len(sample_ids)
    n_snps = len(snp_info)
    total = n_samples * n_snps
    if total == 0:
        return 0.0
    missing = sum(
        1
        for sample_idx in range(n_samples)
        for snp_idx in range(n_snps)
        if translate_dosage(matrix[sample_idx][snp_idx]) == "./."
    )
    return round(missing / total * 100, 4)
