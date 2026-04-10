'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Wrench,
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  Search,
  Link2,
} from 'lucide-react';
import { clsx } from 'clsx';
import FileUpload from '@/components/FileUpload';
import { usePipeline } from '@/context/PipelineContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FixrefStats {
  total: number;
  ref_match: number;
  ref_match_pct: number;
  ref_mismatch: number;
  flipped: number;
  swapped: number;
  flip_swap: number;
  unresolved: number;
}

interface CheckResponse {
  stats: FixrefStats;
}

interface StatusResponse {
  job_id: string;
  status: string;
  module: string;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  before: FixrefStats | null;
  after: FixrefStats | null;
  output_file: string | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

const COMMON_REFS = [
  '/data/refs/Gmax_880_v6.0.fa',
  '/data/refs/Gmax_508_Wm82.a4.v1.fa',
  '/data/refs/Gmax_189_Wm82.a2.v1.fa',
  '/data/refs/GRCh38.fa',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function StatRow({
  label,
  before,
  after,
  highlight,
}: {
  label: string;
  before: number | string;
  after: number | string;
  highlight?: boolean;
}) {
  return (
    <tr
      className={clsx(
        'border-t border-gray-800',
        highlight && 'bg-green-900/10'
      )}
    >
      <td className="px-4 py-2.5 text-sm text-gray-400">{label}</td>
      <td className="px-4 py-2.5 text-sm text-gray-200 text-right font-mono">
        {typeof before === 'number' ? before.toLocaleString() : before}
      </td>
      <td className="px-4 py-2.5 text-sm text-gray-200 text-right font-mono">
        {typeof after === 'number' ? after.toLocaleString() : after}
      </td>
    </tr>
  );
}

function StatsCard({ title, stats }: { title: string; stats: FixrefStats }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 space-y-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{title}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-gray-500">Total sites</p>
          <p className="text-lg font-bold text-white">{stats.total.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">REF match</p>
          <p className="text-lg font-bold text-green-400">
            {stats.ref_match.toLocaleString()}{' '}
            <span className="text-sm font-normal text-gray-400">
              ({stats.ref_match_pct.toFixed(1)}%)
            </span>
          </p>
        </div>
        <div>
          <p className="text-xs text-gray-500">REF mismatch</p>
          <p className="text-lg font-bold text-yellow-400">{stats.ref_mismatch.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Unresolved</p>
          <p className="text-lg font-bold text-red-400">{stats.unresolved.toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FixRefPage() {
  const { pipelineVcf, setPipelineVcf } = usePipeline();

  // VCF file
  const [vcfFileId, setVcfFileId] = useState<string | null>(null);
  const [vcfFileName, setVcfFileName] = useState<string | null>(null);
  const [uploadingVcf, setUploadingVcf] = useState(false);
  const [usingPipeline, setUsingPipeline] = useState(false);
  const [fixOutputFile, setFixOutputFile] = useState<string | null>(null);

  // Reference selection
  const [refMode, setRefMode] = useState<'path' | 'upload'>('path');
  const [refPath, setRefPath] = useState('');
  const [refFileId, setRefFileId] = useState<string | null>(null);
  const [refFileName, setRefFileName] = useState<string | null>(null);
  const [uploadingRef, setUploadingRef] = useState(false);

  // Check
  const [checkStats, setCheckStats] = useState<FixrefStats | null>(null);
  const [checking, setChecking] = useState(false);

  // Fix job
  const [outputFilename, setOutputFilename] = useState('fixed.vcf');
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>('idle');
  const [fixResult, setFixResult] = useState<{ before: FixrefStats; after: FixrefStats } | null>(null);

  // Error
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Polling
  // ---------------------------------------------------------------------------
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const pollJob = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`${API_BASE}/api/fixref/status/${id}`);
        if (!res.ok) {
          stopPolling();
          setError(`Polling error: ${res.status}`);
          return;
        }
        const data: StatusResponse = await res.json();
        setJobStatus(data.status);
        if (data.status === 'completed') {
          stopPolling();
          if (data.before && data.after) {
            setFixResult({ before: data.before, after: data.after });
          }
          if (data.output_file) setFixOutputFile(data.output_file);
        } else if (data.status === 'failed') {
          stopPolling();
          setError(data.error_message ?? 'Job failed with unknown error.');
        }
      } catch (err) {
        stopPolling();
        setError(`Network error while polling: ${String(err)}`);
      }
    },
    [stopPolling]
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  // ---------------------------------------------------------------------------
  // VCF upload
  // ---------------------------------------------------------------------------
  const handleVcfSelected = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploadingVcf(true);
    setError(null);
    setVcfFileId(null);
    setVcfFileName(null);
    setCheckStats(null);
    setJobId(null);
    setJobStatus('idle');
    setFixResult(null);
    stopPolling();

    const baseName = file.name.replace(/\.(vcf\.gz|vcf)$/, '');
    setOutputFilename(`${baseName}_fixed.vcf`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/api/fixref/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? `Upload failed: ${res.status}`);
      }
      const data: { file_id: string; filename: string } = await res.json();
      setVcfFileId(data.file_id);
      setVcfFileName(file.name);
    } catch (err) {
      setError(String(err));
    } finally {
      setUploadingVcf(false);
    }
  };

  // ---------------------------------------------------------------------------
  // FASTA upload
  // ---------------------------------------------------------------------------
  const handleRefSelected = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploadingRef(true);
    setError(null);
    setRefFileId(null);
    setRefFileName(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/api/fixref/upload-ref`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? `Upload failed: ${res.status}`);
      }
      const data: { ref_id: string; filename: string } = await res.json();
      setRefFileId(data.ref_id);
      setRefFileName(file.name);
    } catch (err) {
      setError(String(err));
    } finally {
      setUploadingRef(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Resolve current ref_path value to send to backend
  // ---------------------------------------------------------------------------
  function getEffectiveRefPath(): string | null {
    if (refMode === 'path') {
      return refPath.trim() || null;
    }
    return refFileId;
  }

  // ---------------------------------------------------------------------------
  // Run Check
  // ---------------------------------------------------------------------------
  const handleCheck = async () => {
    if (!vcfFileId) return;
    const effectiveRef = getEffectiveRefPath();
    if (!effectiveRef) return;

    setChecking(true);
    setCheckStats(null);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/fixref/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: vcfFileId, ref_path: effectiveRef }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? `Check failed: ${res.status}`);
      }
      const data: CheckResponse = await res.json();
      setCheckStats(data.stats);
    } catch (err) {
      setError(String(err));
    } finally {
      setChecking(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Run Fix
  // ---------------------------------------------------------------------------
  const handleFix = async () => {
    if (!vcfFileId) return;
    const effectiveRef = getEffectiveRefPath();
    if (!effectiveRef) return;

    setError(null);
    setJobStatus('submitting');
    setFixResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/fixref/fix`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: vcfFileId,
          ref_path: effectiveRef,
          output_filename: outputFilename,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? `Fix submit failed: ${res.status}`);
      }
      const data: { job_id: string; status: string } = await res.json();
      setJobId(data.job_id);
      setJobStatus('pending');
      pollIntervalRef.current = setInterval(() => pollJob(data.job_id), 2000);
    } catch (err) {
      setError(String(err));
      setJobStatus('failed');
    }
  };

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const isRunning =
    jobStatus === 'submitting' || jobStatus === 'pending' || jobStatus === 'running';
  const isDone = jobStatus === 'completed';
  const effectiveRef = getEffectiveRefPath();
  const canCheck = !!vcfFileId && !!effectiveRef && !checking;
  const canFix = !!vcfFileId && !!effectiveRef && !isRunning && !isDone;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Wrench size={22} className="text-blue-400" />
          Fix Reference Alleles
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Detect and correct REF allele mismatches using{' '}
          <code className="text-blue-300 text-xs">bcftools +fixref</code> with flip/swap mode.
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

      {/* 1. VCF Upload */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          1. VCF File
        </h2>

        {/* Pipeline auto-fill */}
        {pipelineVcf && !isDone && (
          <div className="flex items-center gap-3 bg-blue-950/30 border border-blue-800/50 rounded-lg px-4 py-3">
            <Link2 size={14} className="text-blue-400 flex-shrink-0" />
            <span className="text-xs text-blue-300 flex-1">
              Pipeline VCF: <span className="font-mono text-blue-200">{pipelineVcf.filename}</span>
            </span>
            <button
              onClick={() => {
                setUsingPipeline(true);
                setVcfFileId(pipelineVcf.file_id);
                setVcfFileName(pipelineVcf.filename);
                const base = pipelineVcf.filename.replace(/\.(vcf\.gz|vcf|bcf)$/, '');
                setOutputFilename(`${base}_fixed.vcf`);
              }}
              className={`text-xs px-3 py-1 rounded border transition-colors ${
                usingPipeline
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'border-blue-700 text-blue-400 hover:bg-blue-900/40'
              }`}
            >
              {usingPipeline ? '✓ Using pipeline VCF' : 'Use pipeline VCF'}
            </button>
          </div>
        )}

        {!usingPipeline && (
          <>
            <FileUpload
              accept=".vcf,.vcf.gz"
              multiple={false}
              onFiles={handleVcfSelected}
              label="Drop VCF file here or click to browse"
              description="Supports .vcf and .vcf.gz"
            />
            {uploadingVcf && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 size={14} className="animate-spin" />
                Uploading…
              </div>
            )}
          </>
        )}
        {vcfFileName && !uploadingVcf && (
          <div className="flex items-center gap-2 text-sm text-green-400">
            <CheckCircle size={14} />
            Ready: <span className="font-medium">{vcfFileName}</span>
          </div>
        )}
      </div>

      {/* 2. Reference Selection */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          2. Select Reference FASTA
        </h2>

        {/* Toggle */}
        <div className="flex gap-3">
          <button
            onClick={() => setRefMode('path')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
              refMode === 'path'
                ? 'bg-blue-600/20 border-blue-600 text-blue-300'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
            )}
          >
            Server Path
          </button>
          <button
            onClick={() => setRefMode('upload')}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors border',
              refMode === 'upload'
                ? 'bg-blue-600/20 border-blue-600 text-blue-300'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'
            )}
          >
            Upload FASTA
          </button>
        </div>

        {refMode === 'path' && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                Absolute path to FASTA on server
              </label>
              <input
                type="text"
                value={refPath}
                onChange={(e) => setRefPath(e.target.value)}
                placeholder="/data/refs/Gmax_880_v6.0.fa"
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="bg-gray-800/60 rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 mb-2 font-medium">Common soybean references:</p>
              <ul className="space-y-1">
                {COMMON_REFS.map((ref) => (
                  <li key={ref}>
                    <button
                      onClick={() => setRefPath(ref)}
                      className="text-xs text-blue-400 hover:text-blue-300 font-mono transition-colors"
                    >
                      {ref}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {refMode === 'upload' && (
          <div className="space-y-3">
            <p className="text-xs text-yellow-400 flex items-center gap-1">
              <AlertCircle size={12} />
              Warning: Large FASTA files may time out during upload. Use server path for pre-installed references.
            </p>
            <FileUpload
              accept=".fa,.fasta,.fa.gz,.fasta.gz"
              multiple={false}
              onFiles={handleRefSelected}
              label="Drop FASTA file here or click to browse"
              description="Supports .fa, .fasta, .fa.gz, .fasta.gz"
            />
            {uploadingRef && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Loader2 size={14} className="animate-spin" />
                Uploading FASTA…
              </div>
            )}
            {refFileName && !uploadingRef && (
              <div className="flex items-center gap-2 text-sm text-green-400">
                <CheckCircle size={14} />
                Uploaded: <span className="font-medium">{refFileName}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Check (optional) */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              3. Check REF Alleles (Optional)
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Run a read-only check against the reference. Results appear immediately.
            </p>
          </div>
          <button
            onClick={handleCheck}
            disabled={!canCheck}
            className="btn-secondary"
          >
            {checking ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                Checking…
              </>
            ) : (
              <>
                <Search size={14} />
                Run Check
              </>
            )}
          </button>
        </div>

        {checkStats && (
          <StatsCard title="Check Results (Before Fix)" stats={checkStats} />
        )}
      </div>

      {/* 4. Fix */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
              4. Run Fix (Flip / Swap)
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Applies <code className="text-blue-300">bcftools +fixref -m flip</code> to correct
              strand issues and REF/ALT swaps.
            </p>
          </div>
          <button
            onClick={handleFix}
            disabled={!canFix}
            className="btn-primary"
          >
            {isRunning ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Running…
              </>
            ) : isDone ? (
              <>
                <CheckCircle size={15} />
                Completed
              </>
            ) : (
              <>
                <Wrench size={15} />
                Run Fix (flip/swap)
              </>
            )}
          </button>
        </div>

        {vcfFileId && (
          <div className="flex items-center gap-3">
            <label className="text-xs text-gray-400 whitespace-nowrap">Output filename:</label>
            <input
              type="text"
              value={outputFilename}
              onChange={(e) => setOutputFilename(e.target.value)}
              className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        )}

        {isRunning && (
          <div className="flex items-center gap-3 bg-blue-950/40 border border-blue-800 rounded-xl px-5 py-4">
            <Loader2 size={18} className="text-blue-400 animate-spin flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-300">Running bcftools +fixref…</p>
              <p className="text-xs text-blue-500 mt-0.5">
                Job ID: {jobId} — Status: {jobStatus}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 5. Results */}
      {isDone && fixResult && (
        <div className="card space-y-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            5. Results — Before vs After
          </h2>

          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <StatsCard title="Before Fix" stats={fixResult.before} />
            <StatsCard title="After Fix" stats={fixResult.after} />
          </div>

          {/* Detailed comparison table */}
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 bg-gray-800/50">
                  <th className="px-4 py-3">Metric</th>
                  <th className="px-4 py-3 text-right">Before</th>
                  <th className="px-4 py-3 text-right">After</th>
                </tr>
              </thead>
              <tbody>
                <StatRow
                  label="Total Sites"
                  before={fixResult.before.total}
                  after={fixResult.after.total}
                />
                <StatRow
                  label="REF Match"
                  before={`${fixResult.before.ref_match.toLocaleString()} (${fixResult.before.ref_match_pct.toFixed(1)}%)`}
                  after={`${fixResult.after.ref_match.toLocaleString()} (${fixResult.after.ref_match_pct.toFixed(1)}%)`}
                  highlight
                />
                <StatRow
                  label="REF Mismatch"
                  before={fixResult.before.ref_mismatch}
                  after={fixResult.after.ref_mismatch}
                />
                <StatRow
                  label="Flipped"
                  before={fixResult.before.flipped}
                  after={fixResult.after.flipped}
                />
                <StatRow
                  label="Swapped"
                  before={fixResult.before.swapped}
                  after={fixResult.after.swapped}
                />
                <StatRow
                  label="Flip + Swap"
                  before={fixResult.before.flip_swap}
                  after={fixResult.after.flip_swap}
                />
                <StatRow
                  label="Unresolved"
                  before={fixResult.before.unresolved}
                  after={fixResult.after.unresolved}
                />
              </tbody>
            </table>
          </div>

          {/* Download + pipeline */}
          <div className="flex items-center justify-between gap-4 flex-wrap bg-gray-800/50 rounded-xl px-5 py-4">
            <div>
              <p className="text-sm font-medium text-gray-200">Download Fixed VCF</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Output: <code className="text-blue-300">{outputFilename}</code>
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => jobId && window.open(`${API_BASE}/api/fixref/download/${jobId}`, '_blank')}
                className="btn-primary"
              >
                <Download size={15} />
                Download Fixed VCF
              </button>
              {fixOutputFile && (
                <button
                  onClick={() =>
                    setPipelineVcf({
                      file_id: fixOutputFile,
                      filename: outputFilename,
                      sample_count: pipelineVcf?.sample_count,
                      source: 'fixref',
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
    </div>
  );
}
