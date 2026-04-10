'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FilePlus2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  Upload,
  Link2,
  FolderOpen,
} from 'lucide-react';
import FileUpload from '@/components/FileUpload';
import { usePipeline } from '@/context/PipelineContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GenoPreviewRow {
  sample_id: string;
  [snp: string]: string;
}

interface SnpPreviewRow {
  CHROM: string;
  POS: number;
  ID: string;
  REF: string;
  ALT: string;
}

interface GenoBadge {
  sample_count: number;
  snp_count: number;
}

interface SnpBadge {
  snp_count: number;
  columns_found: string[];
}

interface GeneratorResult {
  snp_count: number;
  sample_count: number;
  missing_pct: number;
  output_file: string;
  file_size?: number;
  warning?: string;
  vcf_valid?: boolean;
  vcf_check_message?: string;
}

interface StatusResponse {
  job_id: string;
  status: string;
  module: string;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  result: GeneratorResult | null;
}

type Orientation = 'samples_as_rows' | 'snps_as_rows' | 'auto';
type ActiveTab = 'load' | 'generate';

interface LoadVcfResult {
  file_id: string;
  filename: string;
  valid: boolean;
  vcf_check_message: string;
  sample_count: number;
  assembly_detected: string | null;
  reference_line: string | null;
  contig_count: number;
  file_format: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const API_BASE = API_URL;

const ASSEMBLY_OPTIONS = [
  'Wm82.a6.v1',
  'Wm82.a4.v1',
  'Wm82.a1.v1',
  'GRCh38',
  'GRCh37',
  'Custom...',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatPct(pct: number): string {
  return `${pct.toFixed(2)}%`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function GeneratorPage() {
  const { setPipelineVcf } = usePipeline();

  // Active tab
  const [activeTab, setActiveTab] = useState<ActiveTab>('load');

  // Load VCF tab state
  const [loadPendingFile, setLoadPendingFile] = useState<File | null>(null);
  const [loadUploading, setLoadUploading] = useState(false);
  const [loadResult, setLoadResult] = useState<LoadVcfResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Genotype upload state
  const [genoFileId, setGenoFileId] = useState<string | null>(null);
  const [genoPreview, setGenoPreview] = useState<GenoPreviewRow[]>([]);
  const [genoPreviewSnps, setGenoPreviewSnps] = useState<string[]>([]);
  const [genoBadge, setGenoBadge] = useState<GenoBadge | null>(null);
  const [uploadingGeno, setUploadingGeno] = useState(false);
  const [pendingGenoFile, setPendingGenoFile] = useState<File | null>(null);
  const [orientation, setOrientation] = useState<Orientation>('auto');

  // SNP info upload state
  const [snpFileId, setSnpFileId] = useState<string | null>(null);
  const [snpPreview, setSnpPreview] = useState<SnpPreviewRow[]>([]);
  const [snpBadge, setSnpBadge] = useState<SnpBadge | null>(null);
  const [uploadingSnp, setUploadingSnp] = useState(false);
  const [pendingSnpFile, setPendingSnpFile] = useState<File | null>(null);

  // Input type and header file state
  const [inputType, setInputType] = useState<'genotype_matrix' | 'agriplex' | 'dartag'>('genotype_matrix');
  const [pendingHeaderFile, setPendingHeaderFile] = useState<File | null>(null);
  const [headerFileId, setHeaderFileId] = useState<string | null>(null);
  const [headerContigCount, setHeaderContigCount] = useState<number>(0);
  const [contigCheck, setContigCheck] = useState<{ ok: boolean; matched: number; missing: string[] } | null>(null);

  // Generation options
  const [assembly, setAssembly] = useState<string>('Wm82.a6.v1');
  const [customAssembly, setCustomAssembly] = useState<string>('');
  const [outputFilename, setOutputFilename] = useState<string>('output.vcf');

  // Job state
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>('idle');
  const [result, setResult] = useState<GeneratorResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Upload header file when pendingHeaderFile changes
  useEffect(() => {
    if (!pendingHeaderFile) return;
    const upload = async () => {
      const fd = new FormData();
      fd.append('file', pendingHeaderFile);
      const res = await fetch(`${API_URL}/api/generator/upload-header`, { method: 'POST', body: fd });
      if (res.ok) {
        const data = await res.json();
        setHeaderFileId(data.file_id);
        setHeaderContigCount(data.contig_count);
      }
    };
    upload();
  }, [pendingHeaderFile]);

  // Run contig check when both snpFileId and headerFileId are set
  useEffect(() => {
    if (!snpFileId || !headerFileId) return;
    const check = async () => {
      const res = await fetch(`${API_URL}/api/generator/check-contigs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ header_file_id: headerFileId, snp_file_id: snpFileId }),
      });
      if (res.ok) setContigCheck(await res.json());
    };
    check();
  }, [snpFileId, headerFileId]);

  const pollJob = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`${API_BASE}/api/generator/status/${id}`);
        if (!res.ok) {
          stopPolling();
          setError(`Polling error: ${res.status}`);
          return;
        }
        const data: StatusResponse = await res.json();
        setJobStatus(data.status);
        if (data.status === 'completed') {
          stopPolling();
          if (data.result) setResult(data.result);
        } else if (data.status === 'failed') {
          stopPolling();
          setError(data.error_message ?? 'Generation job failed.');
        }
      } catch (err) {
        stopPolling();
        setError(`Network error: ${String(err)}`);
      }
    },
    [stopPolling]
  );

  // ---------------------------------------------------------------------------
  // Load VCF (integrity check)
  // ---------------------------------------------------------------------------
  const handleLoadVcf = async () => {
    if (!loadPendingFile) return;
    setLoadUploading(true);
    setLoadError(null);
    setLoadResult(null);

    try {
      const fd = new FormData();
      fd.append('file', loadPendingFile);
      const res = await fetch(`${API_BASE}/api/generator/load-vcf`, {
        method: 'POST',
        body: fd,
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? `Upload failed: ${res.status}`);
      }
      const data: LoadVcfResult = await res.json();
      setLoadResult(data);
    } catch (err) {
      setLoadError(String(err));
    } finally {
      setLoadUploading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Upload genotype file
  // ---------------------------------------------------------------------------
  const handleUploadGeno = async () => {
    if (!pendingGenoFile) return;
    setUploadingGeno(true);
    setError(null);
    setGenoFileId(null);
    setGenoBadge(null);
    setGenoPreview([]);

    try {
      const formData = new FormData();
      formData.append('file', pendingGenoFile);
      formData.append('orientation', orientation);

      const res = await fetch(`${API_BASE}/api/generator/upload-genotypes?orientation=${orientation}&input_type=${inputType}`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? `Upload failed: ${res.status}`);
      }

      const data: {
        file_id: string;
        sample_count: number;
        snp_count: number;
        orientation_detected: string;
        preview: GenoPreviewRow[];
      } = await res.json();

      setGenoFileId(data.file_id);
      setGenoBadge({ sample_count: data.sample_count, snp_count: data.snp_count });

      // Extract SNP column keys from preview (all keys except sample_id)
      const previewSnps =
        data.preview.length > 0
          ? Object.keys(data.preview[0]).filter((k) => k !== 'sample_id')
          : [];
      setGenoPreviewSnps(previewSnps);
      setGenoPreview(data.preview);
    } catch (err) {
      setError(String(err));
    } finally {
      setUploadingGeno(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Upload SNP info file
  // ---------------------------------------------------------------------------
  const handleUploadSnp = async () => {
    if (!pendingSnpFile) return;
    setUploadingSnp(true);
    setError(null);
    setSnpFileId(null);
    setSnpBadge(null);
    setSnpPreview([]);

    try {
      const formData = new FormData();
      formData.append('file', pendingSnpFile);

      const res = await fetch(`${API_BASE}/api/generator/upload-snp-info`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? `Upload failed: ${res.status}`);
      }

      const data: {
        file_id: string;
        snp_count: number;
        columns_found: string[];
        preview: SnpPreviewRow[];
      } = await res.json();

      setSnpFileId(data.file_id);
      setSnpBadge({ snp_count: data.snp_count, columns_found: data.columns_found });
      setSnpPreview(data.preview);
    } catch (err) {
      setError(String(err));
    } finally {
      setUploadingSnp(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Submit generation
  // ---------------------------------------------------------------------------
  const handleGenerate = async () => {
    if (!genoFileId || (inputType === 'genotype_matrix' && !snpFileId)) return;
    const effectiveAssembly = assembly === 'Custom...' ? customAssembly.trim() : assembly;
    if (!effectiveAssembly) {
      setError('Please enter a custom assembly name.');
      return;
    }

    setError(null);
    setResult(null);
    setJobStatus('submitting');
    stopPolling();

    try {
      const res = await fetch(`${API_BASE}/api/generator/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geno_file_id: genoFileId,
          snp_file_id: snpFileId ?? '',
          assembly: effectiveAssembly,
          output_filename: outputFilename || 'output.vcf',
          orientation,
          input_type: inputType,
          header_file_id: headerFileId ?? undefined,
        }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        const msg = typeof detail.detail === 'string'
          ? detail.detail
          : JSON.stringify(detail.detail);
        throw new Error(msg ?? `Submit failed: ${res.status}`);
      }

      const data: { job_id: string; status: string } = await res.json();
      setJobId(data.job_id);
      setJobStatus('pending');
      pollRef.current = setInterval(() => pollJob(data.job_id), 2000);
    } catch (err) {
      setError(String(err));
      setJobStatus('failed');
    }
  };

  // ---------------------------------------------------------------------------
  // Download
  // ---------------------------------------------------------------------------
  const handleDownload = () => {
    if (!jobId) return;
    window.open(`${API_BASE}/api/generator/download/${jobId}`, '_blank');
  };

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const isRunning =
    jobStatus === 'submitting' || jobStatus === 'pending' || jobStatus === 'running';
  const isDone = jobStatus === 'completed';
  const effectiveAssembly = assembly === 'Custom...' ? customAssembly : assembly;
  const canGenerate =
    !!genoFileId &&
    (inputType !== 'genotype_matrix' || !!snpFileId) &&
    !!effectiveAssembly.trim() &&
    !isRunning &&
    !isDone;

  const snpCountMismatch =
    genoBadge && snpBadge && genoBadge.snp_count !== snpBadge.snp_count;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <FilePlus2 size={22} className="text-green-400" />
          Load / Generate VCF
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Load an existing VCF for integrity checking, or generate a new VCF from genotype data.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 border-b border-gray-800 pb-0">
        {(['load', 'generate'] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? 'border-green-500 text-green-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            }`}
          >
            {tab === 'load' ? (
              <span className="flex items-center gap-1.5"><FolderOpen size={14} />Load VCF</span>
            ) : (
              <span className="flex items-center gap-1.5"><FilePlus2 size={14} />Generate VCF</span>
            )}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Load VCF tab                                                        */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'load' && (
        <div className="space-y-4">
          <div className="card space-y-4">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              Upload VCF File
            </h2>
            <p className="text-xs text-gray-500">
              Accepts .vcf, .vcf.gz, or .bcf. Validates with bcftools and extracts header info.
            </p>
            <FileUpload
              accept=".vcf,.vcf.gz,.bcf"
              multiple={false}
              onFiles={(files) => {
                setLoadPendingFile(files[0] ?? null);
                setLoadResult(null);
                setLoadError(null);
              }}
              label="Drop VCF file here or click to browse"
              description="Accepts .vcf, .vcf.gz, .bcf"
            />
            {loadPendingFile && !loadResult && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">{loadPendingFile.name} ready</p>
                <button
                  onClick={handleLoadVcf}
                  disabled={loadUploading}
                  className="btn-primary"
                >
                  {loadUploading ? (
                    <><Loader2 size={14} className="animate-spin" />Checking…</>
                  ) : (
                    <><Upload size={14} />Check Integrity</>
                  )}
                </button>
              </div>
            )}
          </div>

          {loadError && (
            <div className="flex items-start gap-3 bg-red-950/60 border border-red-800 rounded-xl px-5 py-4">
              <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-300">Error</p>
                <p className="text-sm text-red-400 mt-0.5">{loadError}</p>
              </div>
            </div>
          )}

          {loadResult && (
            <div className="card space-y-4">
              <div className="flex items-center gap-2">
                {loadResult.valid ? (
                  <CheckCircle size={18} className="text-green-400" />
                ) : (
                  <AlertCircle size={18} className="text-red-400" />
                )}
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                  Integrity Check — {loadResult.valid ? 'Passed' : 'Failed'}
                </h2>
              </div>

              {!loadResult.valid && (
                <p className="text-xs text-red-400 bg-red-950/40 border border-red-800 rounded px-3 py-2">
                  {loadResult.vcf_check_message}
                </p>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="stat-card">
                  <p className="text-xs text-gray-500">Samples</p>
                  <p className="text-2xl font-bold text-white">
                    {loadResult.sample_count.toLocaleString()}
                  </p>
                </div>
                <div className="stat-card">
                  <p className="text-xs text-gray-500">Contigs</p>
                  <p className="text-2xl font-bold text-white">
                    {loadResult.contig_count.toLocaleString()}
                  </p>
                </div>
                <div className="stat-card">
                  <p className="text-xs text-gray-500">Assembly</p>
                  <p className="text-lg font-bold text-white truncate">
                    {loadResult.assembly_detected ?? '—'}
                  </p>
                </div>
                <div className="stat-card">
                  <p className="text-xs text-gray-500">Format</p>
                  <p className="text-lg font-bold text-white">
                    {loadResult.file_format ?? '—'}
                  </p>
                </div>
              </div>

              {loadResult.reference_line && (
                <p className="text-xs text-gray-500">
                  ##reference: <span className="text-gray-300 font-mono">{loadResult.reference_line}</span>
                </p>
              )}

              {loadResult.valid && (
                <button
                  onClick={() =>
                    setPipelineVcf({
                      file_id: loadResult.file_id,
                      filename: loadResult.filename,
                      sample_count: loadResult.sample_count,
                      assembly: loadResult.assembly_detected ?? undefined,
                      source: 'load',
                    })
                  }
                  className="btn-primary"
                  style={{ backgroundColor: '#2563eb' }}
                >
                  <Link2 size={14} />
                  Use in pipeline →
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Generate VCF tab                                                    */}
      {/* ------------------------------------------------------------------ */}
      {activeTab === 'generate' && (
      <>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-3 bg-red-950/60 border border-red-800 rounded-xl px-5 py-4">
          <AlertCircle size={18} className="text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-300">Error</p>
            <p className="text-sm text-red-400 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* Input Type Selector */}
      <div className="card mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">Input Format</label>
        <div className="flex gap-2">
          {(['genotype_matrix', 'agriplex', 'dartag'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setInputType(t)}
              className={`px-4 py-2 rounded text-sm font-medium border transition-colors ${
                inputType === t
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-transparent text-gray-400 border-gray-600 hover:border-blue-400'
              }`}
            >
              {t === 'genotype_matrix' ? 'Genotype Matrix (0/1/2)' : t === 'agriplex' ? 'Agriplex' : 'DArTag'}
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">
          {inputType === 'genotype_matrix' && 'Numeric dosage table (0/1/2). Requires separate VCF ID table.'}
          {inputType === 'agriplex' && 'Agriplex CSV with BARC marker rows (BARC_1_01_Gm01_POS_REF_ALT). CHROM/POS/REF/ALT extracted from marker IDs.'}
          {inputType === 'dartag' && 'DArTag CSV with marker rows named Gm01_POS_REF_ALT. Colon-separated genotypes (A:G). Missing = -/-.'}
        </p>
      </div>

      {/* Step 1: Genotype Matrix */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-1 uppercase tracking-wide">
          1. Genotype Matrix
        </h2>
        <p className="text-xs text-gray-500">
          {inputType === 'genotype_matrix'
            ? 'Upload a dosage matrix file. Values should be 0, 1, 2, or NA/missing.'
            : inputType === 'agriplex'
            ? 'Upload Agriplex genotype CSV. Marker IDs should be in BARC_X_XX_GmXX_POS_REF_ALT format.'
            : 'Upload DArTag genotype CSV. Marker IDs should be in GmXX_POS_REF_ALT format.'}
        </p>

        {/* Orientation selector */}
        <div>
          <p className="text-xs font-medium text-gray-400 mb-2">Matrix orientation</p>
          <div className="flex flex-col gap-2">
            {(
              [
                { value: 'auto', label: 'Auto-detect (recommended)' },
                { value: 'samples_as_rows', label: 'Samples as rows (first col = sample ID, remaining cols = SNPs)' },
                { value: 'snps_as_rows', label: 'SNPs as rows (first col = SNP ID, remaining cols = samples)' },
              ] as { value: Orientation; label: string }[]
            ).map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="orientation"
                  value={opt.value}
                  checked={orientation === opt.value}
                  onChange={() => setOrientation(opt.value)}
                  className="accent-green-500"
                />
                <span className="text-sm text-gray-300">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>

        <FileUpload
          accept=".genotypes,.csv,.tsv,.txt"
          multiple={false}
          onFiles={(files) => setPendingGenoFile(files[0] ?? null)}
          label="Drop genotype matrix here or click to browse"
          description="Accepts .genotypes, .csv, .tsv, .txt"
        />

        {pendingGenoFile && !genoFileId && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              {pendingGenoFile.name} ready to upload
            </p>
            <button
              onClick={handleUploadGeno}
              disabled={uploadingGeno}
              className="btn-primary"
            >
              {uploadingGeno ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Uploading & parsing…
                </>
              ) : (
                <>
                  <Upload size={14} />
                  Upload & Preview
                </>
              )}
            </button>
          </div>
        )}

        {/* Badge */}
        {genoBadge && (
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 bg-green-900/30 border border-green-700 text-green-300 text-xs px-3 py-1 rounded-full">
              <CheckCircle size={12} />
              Samples: {genoBadge.sample_count.toLocaleString()} | SNPs: {genoBadge.snp_count.toLocaleString()}
            </span>
          </div>
        )}

        {/* Preview table */}
        {genoPreview.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">
              Preview — first {genoPreview.length} sample(s) × first {genoPreviewSnps.length} SNP(s)
            </p>
            <div className="overflow-x-auto rounded-lg border border-gray-800">
              <table className="text-xs text-gray-300 w-full">
                <thead>
                  <tr className="bg-gray-800/60 text-gray-500">
                    <th className="px-3 py-2 text-left font-medium">Sample ID</th>
                    {genoPreviewSnps.map((snp) => (
                      <th key={snp} className="px-3 py-2 text-left font-mono font-medium">
                        {snp}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {genoPreview.map((row, i) => (
                    <tr key={i} className="border-t border-gray-800">
                      <td className="px-3 py-2 font-medium text-gray-200">{row.sample_id}</td>
                      {genoPreviewSnps.map((snp) => (
                        <td key={snp} className="px-3 py-2 font-mono text-gray-400">
                          {row[snp] ?? '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Step 2: SNP Info + VCF Header */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-1 uppercase tracking-wide">
          2. SNP Info &amp; Header
        </h2>

        {/* SNP ID + VCF Header row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Left: VCF ID table */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              VCF ID Table{' '}
              {inputType !== 'genotype_matrix' && (
                <span className="text-gray-500 font-normal">(optional)</span>
              )}
            </label>
            <p className="text-xs text-gray-500 mb-2">
              {inputType === 'genotype_matrix'
                ? 'Required: CHROM, POS, REF, ALT (and optionally ID).'
                : 'Optional SNP metadata. If omitted, CHROM/POS/REF/ALT are extracted from marker IDs.'}
            </p>
            <FileUpload
              accept=".txt,.csv,.tsv,.bed"
              multiple={false}
              onFiles={(files) => setPendingSnpFile(files[0] ?? null)}
              label="Drop SNP info file here or click to browse"
              description="Accepts .txt, .csv, .tsv, .bed"
            />

            {pendingSnpFile && !snpFileId && (
              <div className="flex items-center justify-between mt-2">
                <p className="text-sm text-gray-400 truncate">
                  {pendingSnpFile.name}
                </p>
                <button
                  onClick={handleUploadSnp}
                  disabled={uploadingSnp}
                  className="btn-primary ml-2"
                >
                  {uploadingSnp ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Uploading…
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      Upload
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Badge */}
            {snpBadge && (
              <div className="flex flex-wrap items-center gap-3 mt-2">
                <span className="inline-flex items-center gap-1.5 bg-green-900/30 border border-green-700 text-green-300 text-xs px-3 py-1 rounded-full">
                  <CheckCircle size={12} />
                  SNPs: {snpBadge.snp_count.toLocaleString()} | Columns: [{snpBadge.columns_found.join(', ')}]
                </span>
                {snpCountMismatch && (
                  <span className="inline-flex items-center gap-1.5 bg-yellow-900/30 border border-yellow-700 text-yellow-300 text-xs px-3 py-1 rounded-full">
                    <AlertCircle size={12} />
                    SNP count mismatch: genotype has {genoBadge!.snp_count.toLocaleString()} vs SNP info has {snpBadge.snp_count.toLocaleString()}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Right: VCF Header file */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              VCF Header File <span className="text-gray-500 font-normal">(optional)</span>
            </label>
            <p className="text-xs text-gray-500 mb-2">
              Upload a .txt or .vcf file containing ##contig lines to inject into the output header.
            </p>
            <div
              className="border-2 border-dashed border-gray-700 rounded-lg p-4 text-center cursor-pointer hover:border-blue-500 transition-colors"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) setPendingHeaderFile(f);
              }}
              onClick={() => document.getElementById('header-file-input')?.click()}
            >
              <input
                id="header-file-input"
                type="file"
                className="hidden"
                accept=".txt,.vcf"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setPendingHeaderFile(f);
                }}
              />
              {pendingHeaderFile ? (
                <p className="text-sm text-gray-300">{pendingHeaderFile.name}</p>
              ) : (
                <p className="text-sm text-gray-500">
                  Drop .txt or .vcf header file here
                  <br />
                  Contains ##contig lines
                </p>
              )}
            </div>
            {headerFileId && (
              <p className="text-xs text-green-500 mt-1">&#10003; {headerContigCount} contigs loaded</p>
            )}
            {contigCheck && (
              <p className={`text-xs mt-1 ${contigCheck.ok ? 'text-green-500' : 'text-yellow-400'}`}>
                {contigCheck.ok
                  ? `\u2713 All ${contigCheck.matched} contigs match`
                  : `\u26a0 ${contigCheck.missing.length} contigs missing: ${contigCheck.missing.slice(0, 3).join(', ')}${contigCheck.missing.length > 3 ? '...' : ''}`}
              </p>
            )}
          </div>
        </div>

        {/* Preview table */}
        {snpPreview.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 mb-2">
              Preview — first {snpPreview.length} SNP(s)
            </p>
            <div className="overflow-x-auto rounded-lg border border-gray-800">
              <table className="text-xs text-gray-300 w-full">
                <thead>
                  <tr className="bg-gray-800/60 text-gray-500">
                    {['CHROM', 'POS', 'ID', 'REF', 'ALT'].map((col) => (
                      <th key={col} className="px-3 py-2 text-left font-medium">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {snpPreview.map((row, i) => (
                    <tr key={i} className="border-t border-gray-800">
                      <td className="px-3 py-2 font-mono">{row.CHROM}</td>
                      <td className="px-3 py-2 font-mono">{row.POS}</td>
                      <td className="px-3 py-2 font-mono text-gray-400">{row.ID}</td>
                      <td className="px-3 py-2 font-mono">{row.REF}</td>
                      <td className="px-3 py-2 font-mono">{row.ALT}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Step 3: Generation Options */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-1 uppercase tracking-wide">
          3. Generation Options
        </h2>

        {/* Assembly dropdown */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Reference assembly
          </label>
          <select
            value={assembly}
            onChange={(e) => setAssembly(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
          >
            {ASSEMBLY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        {/* Custom assembly input */}
        {assembly === 'Custom...' && (
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Custom assembly name
            </label>
            <input
              type="text"
              value={customAssembly}
              onChange={(e) => setCustomAssembly(e.target.value)}
              placeholder="e.g. My_Genome_v2"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
            />
          </div>
        )}

        {/* Output filename */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            Output filename
          </label>
          <input
            type="text"
            value={outputFilename}
            onChange={(e) => setOutputFilename(e.target.value)}
            placeholder="output.vcf"
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent"
          />
          <p className="text-xs text-gray-600 mt-1">Output will be a plain VCF text file.</p>
        </div>
      </div>

      {/* Step 4: Generate Button */}
      <div className="card flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-medium text-gray-200">Generate VCF</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {!genoFileId
              ? 'Upload and preview a genotype matrix first.'
              : inputType === 'genotype_matrix' && !snpFileId
              ? 'Upload and preview a SNP info file.'
              : !effectiveAssembly.trim()
              ? 'Enter a custom assembly name.'
              : isDone
              ? 'Generation complete. Download your VCF below.'
              : 'Ready to generate. Click Generate VCF.'}
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={!canGenerate}
          className="btn-primary"
          style={{ backgroundColor: canGenerate ? '#16a34a' : undefined }}
        >
          {isRunning ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Generating…
            </>
          ) : isDone ? (
            <>
              <CheckCircle size={15} />
              Completed
            </>
          ) : (
            <>
              <FilePlus2 size={15} />
              Generate VCF
            </>
          )}
        </button>
      </div>

      {/* Running indicator */}
      {isRunning && (
        <div className="flex items-center gap-3 bg-green-950/40 border border-green-800 rounded-xl px-5 py-4">
          <Loader2 size={18} className="text-green-400 animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-300">
              {jobStatus === 'submitting' ? 'Submitting generation job…' : 'Generating VCF file…'}
            </p>
            {jobId && (
              <p className="text-xs text-green-600 mt-0.5">
                Job ID: {jobId} — Status: {jobStatus}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Results card */}
      {isDone && result && (
        <div className="card space-y-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Generation Complete
          </h2>

          {result.warning && (
            <div className="flex items-start gap-2 bg-yellow-950/40 border border-yellow-700 rounded-lg px-4 py-3 text-xs text-yellow-300">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              {result.warning}
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat-card">
              <p className="text-xs text-gray-500">Samples</p>
              <p className="text-2xl font-bold text-white">
                {result.sample_count.toLocaleString()}
              </p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-gray-500">SNPs</p>
              <p className="text-2xl font-bold text-white">
                {result.snp_count.toLocaleString()}
              </p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-gray-500">Missing GT %</p>
              <p
                className={`text-2xl font-bold ${
                  result.missing_pct > 20
                    ? 'text-red-400'
                    : result.missing_pct > 5
                    ? 'text-yellow-400'
                    : 'text-green-400'
                }`}
              >
                {formatPct(result.missing_pct)}
              </p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-gray-500">File Size</p>
              <p className="text-2xl font-bold text-white">
                {result.file_size ? formatBytes(result.file_size) : '—'}
              </p>
            </div>
          </div>

          {result?.vcf_valid !== undefined && (
            <div className={`mt-3 p-2 rounded text-sm ${result.vcf_valid ? 'bg-green-950/40 text-green-400' : 'bg-red-950/40 text-red-400'}`}>
              {result.vcf_valid ? '✓ bcftools validation passed' : `✗ bcftools: ${result.vcf_check_message}`}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-gray-800">
            <div>
              <p className="text-sm font-medium text-gray-200">Download Generated VCF</p>
              <p className="text-xs text-gray-500 mt-0.5">Plain text VCF v4.3 format</p>
            </div>
            <div className="flex gap-2">
              <button onClick={handleDownload} className="btn-primary" style={{ backgroundColor: '#16a34a' }}>
                <Download size={15} />
                Download VCF
              </button>
              {result.output_file && (
                <button
                  onClick={() =>
                    setPipelineVcf({
                      file_id: result.output_file,
                      filename: outputFilename || 'output.vcf',
                      sample_count: result.sample_count,
                      source: 'generate',
                    })
                  }
                  className="btn-primary"
                  style={{ backgroundColor: '#2563eb' }}
                >
                  <Link2 size={15} />
                  Use in pipeline →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
