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
    extra_header_lines: list = None,
) -> str:
    """Build VCF v4.3 header string.

    Includes fileformat, fileDate, source, reference, FORMAT GT meta-line,
    and the #CHROM column header line.

    If extra_header_lines is provided, those lines are injected after the
    ##reference= line and before ##FORMAT=.

    Returns the full header as a single string with newlines.
    """
    today = date.today().strftime("%Y%m%d")
    lines = [
        "##fileformat=VCFv4.3",
        f"##fileDate={today}",
        "##source=VariantTools v0.3.0",
        f"##reference={assembly}",
    ]
    if extra_header_lines:
        lines.extend(extra_header_lines)
    lines.append('##FORMAT=<ID=GT,Number=1,Type=String,Description="Genotype">')
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
    extra_header_lines: list = None,
    pre_translated: bool = False,
) -> str:
    """Generate a complete VCF string (header + data rows).

    For each SNP in snp_info (in order):
      CHROM POS ID REF ALT QUAL=. FILTER=. INFO=. FORMAT=GT <GT per sample>

    matrix[sample_idx][snp_idx] = raw dosage string (or pre-translated VCF GT).
    pre_translated: if True, matrix values are already VCF GT (e.g. '0/0', '0/1')
                    and translate_dosage() is skipped.

    extra_header_lines: optional list of ## lines injected after ##reference=.

    Returns the complete VCF as a string.
    """
    validate_dimensions(sample_ids, snp_info, matrix)

    header = build_vcf_header(assembly, sample_ids, snp_info, extra_header_lines)
    rows: list[str] = []

    n_samples = len(sample_ids)

    for snp_idx, snp in enumerate(snp_info):
        gt_calls = [
            matrix[sample_idx][snp_idx] if pre_translated
            else translate_dosage(matrix[sample_idx][snp_idx])
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
    pre_translated: bool = False,
) -> float:
    """Return fraction of cells that are missing genotype ('./.')."""
    n_samples = len(sample_ids)
    n_snps = len(snp_info)
    total = n_samples * n_snps
    if total == 0:
        return 0.0
    if pre_translated:
        missing = sum(
            1
            for sample_idx in range(n_samples)
            for snp_idx in range(n_snps)
            if matrix[sample_idx][snp_idx] == "./."
        )
    else:
        missing = sum(
            1
            for sample_idx in range(n_samples)
            for snp_idx in range(n_snps)
            if translate_dosage(matrix[sample_idx][snp_idx]) == "./."
        )
    return round(missing / total * 100, 4)


# ---------------------------------------------------------------------------
# VCF header file parser
# ---------------------------------------------------------------------------

def parse_vcf_header_file(content: bytes) -> dict:
    """Parse a VCF header file. Extracts contig IDs and collectable ## lines."""
    text = content.decode("utf-8", errors="replace")
    contig_ids = []
    extra_lines = []
    skip_prefixes = ("##fileformat=", "##source=", "##FORMAT=", "#CHROM")
    for line in text.splitlines():
        line = line.rstrip()
        if not line.startswith("#"):
            continue
        if any(line.startswith(p) for p in skip_prefixes):
            continue
        extra_lines.append(line)
        if line.startswith("##contig="):
            # Extract ID from ##contig=<ID=Gm01,...>
            import re
            m = re.search(r"ID=([^,>]+)", line)
            if m:
                contig_ids.append(m.group(1))
    return {"contig_ids": contig_ids, "extra_lines": extra_lines}


def check_contig_match(header_contigs: list, snp_info: list) -> dict:
    """Check that all CHROMs in snp_info have a matching contig in the header."""
    snp_chroms = set(s["CHROM"] for s in snp_info if s.get("CHROM") not in (".", "", None))
    header_set = set(header_contigs)
    missing = sorted(snp_chroms - header_set)
    matched = len(snp_chroms - set(missing))
    return {
        "ok": len(missing) == 0,
        "matched": matched,
        "missing": missing,
        "total_snp_chroms": len(snp_chroms),
    }


# ---------------------------------------------------------------------------
# Agriplex input parser
# ---------------------------------------------------------------------------

def _translate_agriplex_call(call: str, ref: str, alt: str) -> str:
    """Translate a single Agriplex allele call to VCF GT numeric format.

    Handles:
      - Single letter homozygous: 'A' → '0/0' (if A==ref) or '1/1' (if A==alt)
      - Het with space-slash-space: 'A / G' or 'A/G' → '0/1'
      - Missing/fail: 'FAIL', '', 'NA' → './.'
    """
    call = call.strip()
    if not call or call.upper() in ("FAIL", "NA", "N/A", ".", ""):
        return "./."
    # Multi-allelic: build allele index map
    alt_alleles = [a.strip() for a in alt.split(",")]
    allele_map = {ref.strip().upper(): "0"}
    for i, a in enumerate(alt_alleles, 1):
        allele_map[a.upper()] = str(i)

    if "/" in call:
        parts = call.split("/")
        if len(parts) == 2:
            a1 = allele_map.get(parts[0].strip().upper(), ".")
            a2 = allele_map.get(parts[1].strip().upper(), ".")
            # Sort numerically so 0/1 not 1/0
            if a1 != "." and a2 != ".":
                nums = sorted([int(a1), int(a2)])
                return f"{nums[0]}/{nums[1]}"
            return f"{a1}/{a2}"
        return "./."
    else:
        # Homozygous single allele
        a = allele_map.get(call.upper(), ".")
        if a == ".":
            return "./."
        return f"{a}/{a}"


def parse_agriplex_table(content: bytes) -> tuple:
    """
    Parse Agriplex genotype CSV (QA Genotype Report format).

    File structure:
      Row 0: empty
      Row 1: report name
      Row 2: date
      Row 3: col 3 = 'Customer Marker ID', cols 4+ = marker names
               e.g. 'BARC_1_01_Gm01_138835_A_G'
      Row 4: col 3 = 'AgriPlex ID', cols 4+ = internal IDs (ignored)
      Row 5: col 3 = 'Allele_1', cols 4+ = ref alleles per marker
      Row 6: cols 0-2 = 'Plate name','Well','Sample_ID';
             col 3 = 'Allele_2'; cols 4+ = alt alleles per marker
      Row 7+: sample data rows
              col 0 = plate, col 1 = well, col 2 = Sample_ID
              cols 4+ = genotype calls ('A', 'A / G', 'FAIL')

    CHROM/POS/REF/ALT are parsed from marker names:
      BARC_1_01_Gm01_138835_A_G → chrom=Gm01, pos=138835, ref=A, alt=G

    Returns: (sample_ids, snp_info, matrix)
      matrix[sample_idx][snp_idx] = GT string like '0/1'
    """
    import io, csv as _csv, re as _re

    text = content.decode("utf-8", errors="replace")
    sep = "\t" if "\t" in text.split("\n")[0] else ","
    reader = _csv.reader(io.StringIO(text), delimiter=sep)
    rows = list(reader)

    if not rows:
        raise ValueError("Agriplex file is empty")

    # Find key structural rows
    marker_name_row = None
    data_start_idx = None

    for i, row in enumerate(rows):
        if len(row) > 3 and row[3].strip() == "Customer Marker ID":
            marker_name_row = row
        if len(row) > 2 and row[2].strip() == "Sample_ID":
            data_start_idx = i + 1
            break

    if marker_name_row is None:
        raise ValueError("Agriplex file: could not find 'Customer Marker ID' row")
    if data_start_idx is None:
        raise ValueError("Agriplex file: could not find 'Sample_ID' column header row")

    # Marker names are at indices 4+ in the marker_name_row
    # Build (col_offset_from_4, snp_dict) for valid markers
    markers = []  # list of (col_offset, snp_dict)
    for col_offset, marker_id in enumerate(c.strip() for c in marker_name_row[4:]):
        if not marker_id:
            continue
        parts = marker_id.split("_")
        # BARC_1_01_Gm01_138835_A_G → fields [3],[4],[5],[6]
        if marker_id.upper().startswith("BARC") and len(parts) >= 7:
            chrom, pos_str, ref, alt = parts[3], parts[4], parts[5], parts[6]
        elif len(parts) >= 4:
            # Fallback: Gm01_138835_A_G style
            chrom, pos_str, ref, alt = parts[0], parts[1], parts[2], parts[3]
        else:
            continue
        try:
            pos = int(pos_str)
        except ValueError:
            continue
        markers.append((col_offset, {
            "CHROM": chrom, "POS": str(pos), "ID": marker_id,
            "REF": ref, "ALT": alt,
            "QUAL": ".", "FILTER": ".", "INFO": ".",
        }))

    if not markers:
        raise ValueError("Agriplex file: no valid markers found")

    # Parse sample data rows
    sample_ids = []
    matrix_rows = []  # matrix_rows[sample_idx][snp_idx]

    for row in rows[data_start_idx:]:
        if not row or not any(c.strip() for c in row):
            continue
        if len(row) < 3:
            continue
        sample_id = row[2].strip()
        if not sample_id:
            continue

        geno_vals = row[4:]  # genotype calls at cols 4+
        gt_row = []
        for col_offset, snp in markers:
            raw = geno_vals[col_offset].strip() if col_offset < len(geno_vals) else ""
            gt_row.append(_translate_agriplex_call(raw, snp["REF"], snp["ALT"]))
        sample_ids.append(sample_id)
        matrix_rows.append(gt_row)

    if not sample_ids:
        raise ValueError("Agriplex file: no sample rows found")

    snp_info = [m[1] for m in markers]

    # Sort SNPs by CHROM then POS
    def _snp_sort_key(snp):
        try:
            chrom_num = int(_re.sub(r"[^0-9]", "", snp["CHROM"]) or "0")
        except Exception:
            chrom_num = 0
        try:
            pos_num = int(snp["POS"])
        except Exception:
            pos_num = 0
        return (chrom_num, pos_num)

    sorted_idx = sorted(range(len(snp_info)), key=lambda i: _snp_sort_key(snp_info[i]))
    snp_info = [snp_info[i] for i in sorted_idx]
    matrix = [[row[i] for i in sorted_idx] for row in matrix_rows]

    return sample_ids, snp_info, matrix


# ---------------------------------------------------------------------------
# DArTag input parser
# ---------------------------------------------------------------------------

def _translate_dartag_call(call: str, ref: str, alt: str) -> str:
    """Translate a DArTag colon-separated allele call to VCF GT numeric format.

    Handles:
      - Homozygous: 'A:A' → '0/0' or '1/1'
      - Het: 'A:G' → '0/1'
      - Missing: '', ':', '-:-', 'NA' → './.'
    """
    call = call.strip()
    if not call or call.upper() in ("NA", "N/A", ".", ""):
        return "./."

    allele_map = {ref.strip().upper(): "0", alt.strip().upper(): "1"}

    if ":" in call:
        parts = call.split(":", 1)
        a1_raw = parts[0].strip().upper()
        a2_raw = parts[1].strip().upper()
        if not a1_raw or not a2_raw or a1_raw == "-" or a2_raw == "-":
            return "./."
        a1 = allele_map.get(a1_raw, ".")
        a2 = allele_map.get(a2_raw, ".")
    else:
        # Single allele — treat as homozygous
        a1 = a2 = allele_map.get(call.upper(), ".")

    if "." in (a1, a2):
        return "./."
    nums = sorted([int(a1), int(a2)])
    return f"{nums[0]}/{nums[1]}"


def parse_dartag_table(content: bytes) -> tuple:
    """
    Parse DArTag genotype CSV (Intertek format).

    File structure:
      Row 0: PLATE_ID, WELL, SUBJECT_ID, <marker1>, <marker2>, ...
             Marker names: 'Gm01_1013695_A_G' → chrom=Gm01, pos=1013695, ref=A, alt=G
      Row 1+: sample data rows
              col 0 = PLATE_ID, col 1 = WELL, col 2 = SUBJECT_ID (sample name)
              cols 3+ = genotype calls ('A:A', 'A:G', '' for missing)

    Returns: (sample_ids, snp_info, matrix)
      matrix[sample_idx][snp_idx] = GT string like '0/1'
    """
    import io, csv as _csv, re as _re

    text = content.decode("utf-8", errors="replace")
    sep = "\t" if "\t" in text.split("\n")[0] else ","
    reader = _csv.reader(io.StringIO(text), delimiter=sep)
    rows = list(reader)

    if not rows:
        raise ValueError("DArTag file is empty")

    # Find header row: first row where col 0 == 'PLATE_ID'
    header = None
    header_row_idx = 0
    for i, row in enumerate(rows):
        if row and row[0].strip().upper() == "PLATE_ID":
            header = row
            header_row_idx = i
            break
    if header is None:
        raise ValueError("DArTag file: could not find PLATE_ID header row")

    # Marker names in cols 3+ of header
    # Build (col_offset_from_3, snp_dict) for valid markers
    markers = []
    for col_offset, marker_id in enumerate(h.strip() for h in header[3:]):
        if not marker_id:
            continue
        parts = marker_id.split("_")
        if len(parts) < 4:
            continue
        chrom, pos_str, ref, alt = parts[0], parts[1], parts[2], parts[3]
        try:
            pos = int(pos_str)
        except ValueError:
            continue
        markers.append((col_offset, {
            "CHROM": chrom, "POS": str(pos), "ID": marker_id,
            "REF": ref, "ALT": alt,
            "QUAL": ".", "FILTER": ".", "INFO": ".",
        }))

    if not markers:
        raise ValueError("DArTag file: no valid markers found in header")

    # Parse sample data rows
    sample_ids = []
    matrix_rows = []

    for row in rows[header_row_idx + 1:]:
        if not row or not any(c.strip() for c in row):
            continue
        if len(row) < 3:
            continue
        sample_id = row[2].strip()  # SUBJECT_ID
        if not sample_id:
            continue

        geno_vals = row[3:]  # genotype calls at cols 3+
        gt_row = []
        for col_offset, snp in markers:
            raw = geno_vals[col_offset].strip() if col_offset < len(geno_vals) else ""
            gt_row.append(_translate_dartag_call(raw, snp["REF"], snp["ALT"]))
        sample_ids.append(sample_id)
        matrix_rows.append(gt_row)

    if not sample_ids:
        raise ValueError("DArTag file: no sample rows found")

    snp_info = [m[1] for m in markers]

    # Sort SNPs by CHROM then POS
    def _snp_sort_key(snp):
        try:
            chrom_num = int(_re.sub(r"[^0-9]", "", snp["CHROM"]) or "0")
        except Exception:
            chrom_num = 0
        try:
            pos_num = int(snp["POS"])
        except Exception:
            pos_num = 0
        return (chrom_num, pos_num)

    sorted_idx = sorted(range(len(snp_info)), key=lambda i: _snp_sort_key(snp_info[i]))
    snp_info = [snp_info[i] for i in sorted_idx]
    matrix = [[row[i] for i in sorted_idx] for row in matrix_rows]

    return sample_ids, snp_info, matrix
