'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FilePlus2,
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  Upload,
} from 'lucide-react';
import FileUpload from '@/components/FileUpload';

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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

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

      const res = await fetch(`${API_BASE}/api/generator/upload-genotypes?orientation=${orientation}`, {
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
    if (!genoFileId || !snpFileId) return;
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
          snp_file_id: snpFileId,
          assembly: effectiveAssembly,
          output_filename: outputFilename || 'output.vcf',
          orientation,
        }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? `Submit failed: ${res.status}`);
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
    !!genoFileId && !!snpFileId && !!effectiveAssembly.trim() && !isRunning && !isDone;

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
          VCF Generator
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Convert genotype dosage matrices (0/1/2) to standard VCF format (0/0, 0/1, 1/1).
        </p>
      </div>

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

      {/* Step 1: Genotype Matrix */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-1 uppercase tracking-wide">
          1. Genotype Matrix
        </h2>
        <p className="text-xs text-gray-500">
          Upload a dosage matrix file. Values should be 0, 1, 2, or NA/missing.
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

      {/* Step 2: SNP Info */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 mb-1 uppercase tracking-wide">
          2. SNP Info Table
        </h2>
        <p className="text-xs text-gray-500">
          Upload a SNP metadata file with columns: CHROM, POS, REF, ALT (and optionally ID).
        </p>

        <FileUpload
          accept=".txt,.csv,.tsv,.bed"
          multiple={false}
          onFiles={(files) => setPendingSnpFile(files[0] ?? null)}
          label="Drop SNP info file here or click to browse"
          description="Accepts .txt, .csv, .tsv, .bed"
        />

        {pendingSnpFile && !snpFileId && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              {pendingSnpFile.name} ready to upload
            </p>
            <button
              onClick={handleUploadSnp}
              disabled={uploadingSnp}
              className="btn-primary"
            >
              {uploadingSnp ? (
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
        {snpBadge && (
          <div className="flex flex-wrap items-center gap-3">
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
              : !snpFileId
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

          <div className="flex items-center justify-between pt-2 border-t border-gray-800">
            <div>
              <p className="text-sm font-medium text-gray-200">Download Generated VCF</p>
              <p className="text-xs text-gray-500 mt-0.5">Plain text VCF v4.3 format</p>
            </div>
            <button onClick={handleDownload} className="btn-primary" style={{ backgroundColor: '#16a34a' }}>
              <Download size={15} />
              Download VCF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
