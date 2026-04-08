'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowUpDown,
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  ChevronDown,
  ChevronUp,
  Upload,
  Server,
} from 'lucide-react';
import { clsx } from 'clsx';
import FileUpload from '@/components/FileUpload';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ChainFileRecord {
  id: string;
  name: string;
  source_assembly: string;
  target_assembly: string;
  tool_type: string;
  direction: string;
  file_path: string;
  file_exists: boolean;
  notes: string | null;
  created_at: string;
}

interface LiftoverSummary {
  total: number;
  mapped: number;
  unmapped: number;
  pct_mapped: number;
  output_file: string;
  unmapped_file: string | null;
}

interface StatusResponse {
  job_id: string;
  status: string;
  module: string;
  created_at: string;
  completed_at: string | null;
  error_message: string | null;
  summary: LiftoverSummary | null;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pctBadgeClass(pct: number): string {
  if (pct >= 95) return 'bg-green-900/50 text-green-300 border border-green-700';
  if (pct >= 80) return 'bg-yellow-900/50 text-yellow-300 border border-yellow-700';
  return 'bg-red-900/50 text-red-300 border border-red-700';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function LiftoverPage() {
  // Chain files
  const [chainFiles, setChainFiles] = useState<ChainFileRecord[]>([]);
  const [chainLoading, setChainLoading] = useState(true);
  const [selectedChainId, setSelectedChainId] = useState<string | null>(null);
  const [showChainUpload, setShowChainUpload] = useState(false);

  // Chain upload form
  const [chainUploadFile, setChainUploadFile] = useState<File | null>(null);
  const [chainName, setChainName] = useState('');
  const [chainSource, setChainSource] = useState('');
  const [chainTarget, setChainTarget] = useState('');
  const [chainDirection, setChainDirection] = useState<'fwd' | 'rev' | 'both'>('fwd');
  const [uploadingChain, setUploadingChain] = useState(false);

  // Input file
  const [uploadedFileId, setUploadedFileId] = useState<string | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [inputFormat, setInputFormat] = useState<'vcf' | 'bed'>('vcf');
  const [outputFilename, setOutputFilename] = useState('liftover_output.vcf');
  const [uploadingInput, setUploadingInput] = useState(false);

  // Job
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>('idle');
  const [result, setResult] = useState<LiftoverSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSlurm, setShowSlurm] = useState(false);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---------------------------------------------------------------------------
  // Load chain files on mount
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/liftover/chain-files`);
        if (!res.ok) throw new Error(`Failed to load chain files: ${res.status}`);
        const data: ChainFileRecord[] = await res.json();
        setChainFiles(data);
      } catch (err) {
        setError(String(err));
      } finally {
        setChainLoading(false);
      }
    };
    load();
  }, []);

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
        const res = await fetch(`${API_BASE}/api/liftover/status/${id}`);
        if (!res.ok) {
          stopPolling();
          setError(`Polling error: ${res.status}`);
          return;
        }
        const data: StatusResponse = await res.json();
        setJobStatus(data.status);
        if (data.status === 'completed') {
          stopPolling();
          if (data.summary) setResult(data.summary);
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
  // Upload chain file
  // ---------------------------------------------------------------------------
  const handleChainUpload = async () => {
    if (!chainUploadFile || !chainName || !chainSource || !chainTarget) return;
    setUploadingChain(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', chainUploadFile);
      formData.append('name', chainName);
      formData.append('source_assembly', chainSource);
      formData.append('target_assembly', chainTarget);
      formData.append('direction', chainDirection);

      const res = await fetch(`${API_BASE}/api/liftover/chain-files/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? `Upload failed: ${res.status}`);
      }
      const data: { chain_file_id: string; file_path: string } = await res.json();

      // Reload chain files
      const listRes = await fetch(`${API_BASE}/api/liftover/chain-files`);
      const updated: ChainFileRecord[] = await listRes.json();
      setChainFiles(updated);
      setSelectedChainId(data.chain_file_id);
      setShowChainUpload(false);
      setChainUploadFile(null);
      setChainName('');
      setChainSource('');
      setChainTarget('');
    } catch (err) {
      setError(String(err));
    } finally {
      setUploadingChain(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Upload input file
  // ---------------------------------------------------------------------------
  const handleInputFileSelected = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploadingInput(true);
    setError(null);
    setUploadedFileId(null);
    setUploadedFileName(null);
    setJobId(null);
    setJobStatus('idle');
    setResult(null);
    stopPolling();

    // Auto-detect format
    if (file.name.endsWith('.bed')) setInputFormat('bed');
    else setInputFormat('vcf');

    // Auto-set output filename
    const baseName = file.name.replace(/\.(vcf\.gz|vcf|bed)$/, '');
    setOutputFilename(`${baseName}_lifted.${file.name.endsWith('.bed') ? 'bed' : 'vcf'}`);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/api/liftover/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? `Upload failed: ${res.status}`);
      }
      const data: { file_id: string; filename: string } = await res.json();
      setUploadedFileId(data.file_id);
      setUploadedFileName(file.name);
    } catch (err) {
      setError(String(err));
    } finally {
      setUploadingInput(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Submit liftover
  // ---------------------------------------------------------------------------
  const handleSubmit = async () => {
    if (!uploadedFileId || !selectedChainId) return;
    setError(null);
    setJobStatus('submitting');
    setResult(null);

    try {
      const res = await fetch(`${API_BASE}/api/liftover/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_id: uploadedFileId,
          chain_file_id: selectedChainId,
          input_format: inputFormat,
          output_filename: outputFilename,
        }),
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? `Submit failed: ${res.status}`);
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
  // Download helpers
  // ---------------------------------------------------------------------------
  const handleDownloadMapped = () => {
    if (!jobId) return;
    window.open(`${API_BASE}/api/liftover/download/${jobId}`, '_blank');
  };

  const handleDownloadUnmapped = () => {
    if (!jobId) return;
    window.open(`${API_BASE}/api/liftover/download-unmapped/${jobId}`, '_blank');
  };

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------
  const isRunning =
    jobStatus === 'submitting' || jobStatus === 'pending' || jobStatus === 'running';
  const isDone = jobStatus === 'completed';
  const canSubmit = !!uploadedFileId && !!selectedChainId && !isRunning && !isDone;
  const selectedChain = chainFiles.find((c) => c.id === selectedChainId) ?? null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <ArrowUpDown size={22} className="text-blue-400" />
          Liftover
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Lift over VCF or BED variants between genome assemblies using CrossMap.
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

      {/* 1. Chain File Selection */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          1. Select Chain File
        </h2>

        {chainLoading ? (
          <div className="flex items-center gap-2 text-gray-500 text-sm">
            <Loader2 size={15} className="animate-spin" />
            Loading chain files…
          </div>
        ) : chainFiles.length === 0 ? (
          <p className="text-sm text-gray-500">
            No chain files registered. Upload a custom chain file below.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-800">
            <table className="w-full text-sm text-gray-300">
              <thead>
                <tr className="text-left text-xs text-gray-500 bg-gray-800/50">
                  <th className="px-4 py-3">Select</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Direction</th>
                  <th className="px-4 py-3">File</th>
                </tr>
              </thead>
              <tbody>
                {chainFiles.map((cf) => (
                  <tr
                    key={cf.id}
                    onClick={() => setSelectedChainId(cf.id)}
                    className={clsx(
                      'cursor-pointer border-t border-gray-800 transition-colors',
                      selectedChainId === cf.id
                        ? 'bg-blue-900/30'
                        : 'hover:bg-gray-800/40'
                    )}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="radio"
                        readOnly
                        checked={selectedChainId === cf.id}
                        className="accent-blue-500"
                      />
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-200">{cf.name}</td>
                    <td className="px-4 py-3 font-mono text-xs">{cf.source_assembly}</td>
                    <td className="px-4 py-3 font-mono text-xs">{cf.target_assembly}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">
                        {cf.direction}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {cf.file_exists ? (
                        <span className="inline-flex items-center gap-1 text-xs text-green-400">
                          <CheckCircle size={12} /> Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-yellow-400">
                          <AlertCircle size={12} /> File missing on server
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Upload custom chain toggle */}
        <div>
          <button
            onClick={() => setShowChainUpload((v) => !v)}
            className="btn-secondary text-xs"
          >
            <Upload size={13} />
            Upload Custom Chain File
            {showChainUpload ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>

          {showChainUpload && (
            <div className="mt-4 bg-gray-800/50 rounded-xl p-5 space-y-4 border border-gray-700">
              <p className="text-xs text-gray-400">
                Upload a CrossMap-compatible <code className="text-blue-300">.chain</code> file.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Display Name</label>
                  <input
                    type="text"
                    value={chainName}
                    onChange={(e) => setChainName(e.target.value)}
                    placeholder="e.g. Wm82.a4→a6 FWD"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Direction</label>
                  <select
                    value={chainDirection}
                    onChange={(e) => setChainDirection(e.target.value as 'fwd' | 'rev' | 'both')}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                  >
                    <option value="fwd">Forward (fwd)</option>
                    <option value="rev">Reverse (rev)</option>
                    <option value="both">Both</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Source Assembly</label>
                  <input
                    type="text"
                    value={chainSource}
                    onChange={(e) => setChainSource(e.target.value)}
                    placeholder="e.g. Wm82.a4"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Target Assembly</label>
                  <input
                    type="text"
                    value={chainTarget}
                    onChange={(e) => setChainTarget(e.target.value)}
                    placeholder="e.g. Wm82.a6"
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <FileUpload
                accept=".chain"
                multiple={false}
                onFiles={(files) => setChainUploadFile(files[0] ?? null)}
                label="Drop .chain file here or click to browse"
                description="Only .chain files are accepted"
              />

              {chainUploadFile && (
                <p className="text-xs text-gray-400">
                  Selected: <span className="text-gray-200">{chainUploadFile.name}</span>
                </p>
              )}

              <button
                onClick={handleChainUpload}
                disabled={uploadingChain || !chainUploadFile || !chainName || !chainSource || !chainTarget}
                className="btn-primary"
              >
                {uploadingChain ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    Upload Chain File
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {selectedChain && (
          <div className="flex items-center gap-2 text-xs text-blue-400 bg-blue-900/20 border border-blue-800 rounded-lg px-4 py-2">
            <CheckCircle size={13} />
            Selected: <span className="font-medium">{selectedChain.name}</span>
            <span className="text-gray-500 ml-1">
              ({selectedChain.source_assembly} → {selectedChain.target_assembly})
            </span>
          </div>
        )}
      </div>

      {/* 2. Input File Upload */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
          2. Upload Input File
        </h2>

        <FileUpload
          accept=".vcf,.vcf.gz,.bed"
          multiple={false}
          onFiles={handleInputFileSelected}
          label="Drop VCF or BED file here or click to browse"
          description="Supports .vcf, .vcf.gz, and .bed"
        />

        {uploadingInput && (
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <Loader2 size={14} className="animate-spin" />
            Uploading file to server…
          </div>
        )}

        {uploadedFileName && !uploadingInput && (
          <div className="flex items-center gap-2 text-sm text-green-400">
            <CheckCircle size={14} />
            Uploaded: <span className="font-medium">{uploadedFileName}</span>
            <span className="ml-2 text-xs text-gray-500 uppercase">
              Format: {inputFormat}
            </span>
          </div>
        )}

        {uploadedFileId && (
          <div className="space-y-2">
            <label className="block text-xs text-gray-400">Output Filename</label>
            <input
              type="text"
              value={outputFilename}
              onChange={(e) => setOutputFilename(e.target.value)}
              className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
            />
          </div>
        )}
      </div>

      {/* 3. Submit */}
      <div className="card flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-medium text-gray-200">Run Liftover</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {!selectedChainId
              ? 'Select a chain file first.'
              : !uploadedFileId
              ? 'Upload an input file first.'
              : 'Ready to submit. Click Run Liftover.'}
          </p>
        </div>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
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
              <ArrowUpDown size={15} />
              Run Liftover
            </>
          )}
        </button>
      </div>

      {/* 4. Progress */}
      {isRunning && (
        <div className="flex items-center gap-3 bg-blue-950/40 border border-blue-800 rounded-xl px-5 py-4">
          <Loader2 size={18} className="text-blue-400 animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-300">Running CrossMap liftover…</p>
            <p className="text-xs text-blue-500 mt-0.5">
              Job ID: {jobId} — Status: {jobStatus}
            </p>
          </div>
        </div>
      )}

      {/* 5. Results */}
      {isDone && result && (
        <div className="card space-y-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Results
          </h2>

          {/* Summary stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat-card">
              <p className="text-xs text-gray-500">Total Entries</p>
              <p className="text-2xl font-bold text-white">{result.total.toLocaleString()}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-gray-500">Mapped</p>
              <p className="text-2xl font-bold text-green-400">{result.mapped.toLocaleString()}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-gray-500">Unmapped</p>
              <p className="text-2xl font-bold text-red-400">{result.unmapped.toLocaleString()}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-gray-500">% Mapped</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-2xl font-bold text-white">{result.pct_mapped.toFixed(1)}%</p>
                <span
                  className={clsx(
                    'text-xs px-2 py-0.5 rounded-full font-medium',
                    pctBadgeClass(result.pct_mapped)
                  )}
                >
                  {result.pct_mapped >= 95
                    ? 'Excellent'
                    : result.pct_mapped >= 80
                    ? 'Good'
                    : 'Low'}
                </span>
              </div>
            </div>
          </div>

          {/* Downloads */}
          <div className="flex flex-wrap gap-3">
            <button onClick={handleDownloadMapped} className="btn-primary">
              <Download size={15} />
              Download Mapped File
            </button>
            {result.unmapped_file && (
              <button onClick={handleDownloadUnmapped} className="btn-secondary">
                <Download size={15} />
                Download Unmapped ({result.unmapped.toLocaleString()} entries)
              </button>
            )}
          </div>
        </div>
      )}

      {/* HPC / SLURM section — shown after completion */}
      {isDone && uploadedFileId && selectedChainId && (
        <div className="card space-y-3">
          <button
            onClick={() => setShowSlurm((v) => !v)}
            className="flex items-center gap-2 text-sm font-semibold text-gray-400 hover:text-gray-200 transition-colors w-full"
          >
            <Server size={16} className="text-gray-500" />
            HPC / SLURM
            <span className="ml-auto text-xs text-gray-600">
              {showSlurm ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </span>
          </button>

          {showSlurm && (
            <div className="border-t border-gray-800 pt-4 space-y-3">
              <p className="text-xs text-gray-500">
                For large files, run this liftover on MSI with{' '}
                <code className="text-blue-400 bg-gray-800 px-1 rounded">sbatch script.sh</code>.
                Download a pre-configured SLURM script below.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <a
                  href={`${API_BASE}/api/slurm/script/liftover?chain_file_id=${encodeURIComponent(selectedChainId)}&input_file_id=${encodeURIComponent(uploadedFileId)}&input_format=${encodeURIComponent(inputFormat)}&output_filename=${encodeURIComponent(outputFilename)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-xs"
                >
                  <Download size={13} />
                  Download SLURM Script
                </a>
                <span className="text-xs text-gray-600">
                  Copy to MSI and run:{' '}
                  <code className="text-gray-400">sbatch varianttools_liftover.sh</code>
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
