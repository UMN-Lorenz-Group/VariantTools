'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  GitMerge,
  Upload,
  ChevronDown,
  ChevronUp,
  Server,
} from 'lucide-react';
import FileUpload from '@/components/FileUpload';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UploadedFile {
  file_id: string;
  filename: string;
  size: number;
}

interface MergeOptions {
  norm_multiallelic: boolean;
  output_filename: string;
}

interface MergeResult {
  output_file: string;
  input_file_count: number;
  merge_warnings: number;
  warning_messages: string[];
}

interface MergeStatusResponse {
  job_id: string;
  status: string;
  error_message: string | null;
  result: MergeResult | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MergePage() {
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [mergeOptions, setMergeOptions] = useState<MergeOptions>({
    norm_multiallelic: false,
    output_filename: 'merged.vcf.gz',
  });
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>('idle');
  const [mergeResult, setMergeResult] = useState<MergeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSlurm, setShowSlurm] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollJob = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`${API_BASE}/api/merge/status/${id}`);
        if (!res.ok) {
          stopPolling();
          setError(`Polling error: ${res.status}`);
          return;
        }
        const data: MergeStatusResponse = await res.json();
        setJobStatus(data.status);
        if (data.status === 'completed') {
          stopPolling();
          if (data.result) setMergeResult(data.result);
        } else if (data.status === 'failed') {
          stopPolling();
          setError(data.error_message ?? 'Merge job failed.');
        }
      } catch (err) {
        stopPolling();
        setError(`Network error: ${String(err)}`);
      }
    },
    [stopPolling]
  );

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleFilesSelected = (files: File[]) => {
    setPendingFiles(files);
  };

  const handleUploadFiles = async () => {
    if (pendingFiles.length === 0) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      for (const f of pendingFiles) {
        formData.append('files', f);
      }

      const res = await fetch(`${API_BASE}/api/merge/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? `Upload failed: ${res.status}`);
      }

      const data: { uploaded_files: UploadedFile[] } = await res.json();
      setUploadedFiles((prev) => [...prev, ...data.uploaded_files]);
      setPendingFiles([]);
    } catch (err) {
      setError(String(err));
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveUploaded = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.file_id !== fileId));
  };

  const handleSubmitMerge = async () => {
    if (uploadedFiles.length < 2) {
      setError('Please upload at least 2 VCF files before merging.');
      return;
    }
    setError(null);
    setMergeResult(null);
    setJobStatus('submitting');

    try {
      const res = await fetch(`${API_BASE}/api/merge/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_ids: uploadedFiles.map((f) => f.file_id),
          norm_multiallelic: mergeOptions.norm_multiallelic,
          output_filename: mergeOptions.output_filename || 'merged.vcf.gz',
        }),
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? `Submit failed: ${res.status}`);
      }

      const data: { job_id: string; status: string } = await res.json();
      setJobId(data.job_id);
      setJobStatus('pending');

      // Poll every 3 seconds
      pollRef.current = setInterval(() => pollJob(data.job_id), 3000);
    } catch (err) {
      setError(String(err));
      setJobStatus('failed');
    }
  };

  const handleDownload = () => {
    if (!jobId) return;
    window.open(`${API_BASE}/api/merge/download/${jobId}`, '_blank');
  };

  const isRunning =
    uploading ||
    jobStatus === 'submitting' ||
    jobStatus === 'pending' ||
    jobStatus === 'running';
  const isDone = jobStatus === 'completed';

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <GitMerge size={22} className="text-violet-400" />
          Merge VCFs
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Merge multiple VCF files across samples using bcftools merge.
        </p>
      </div>

      {/* Step 1: Upload files */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          1. Upload VCF Files
        </h2>

        <FileUpload
          accept=".vcf,.vcf.gz"
          multiple={true}
          onFiles={handleFilesSelected}
          label="Drop VCF files here or click to browse"
          description="Select multiple .vcf or .vcf.gz files"
        />

        {pendingFiles.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              {pendingFiles.length} file{pendingFiles.length !== 1 ? 's' : ''} ready to upload
            </p>
            <button
              onClick={handleUploadFiles}
              disabled={uploading}
              className="btn-primary"
            >
              {uploading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Uploading…
                </>
              ) : (
                <>
                  <Upload size={15} />
                  Upload Files
                </>
              )}
            </button>
          </div>
        )}

        {/* Uploaded files list */}
        {uploadedFiles.length > 0 && (
          <div className="mt-5">
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wide">
              Uploaded ({uploadedFiles.length})
            </p>
            <ul className="space-y-2">
              {uploadedFiles.map((f) => (
                <li
                  key={f.file_id}
                  className="flex items-center gap-3 bg-gray-800 border border-green-800/40 rounded-lg px-3 py-2"
                >
                  <CheckCircle size={15} className="text-green-500 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">{f.filename}</p>
                    <p className="text-xs text-gray-500">{formatBytes(f.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveUploaded(f.file_id)}
                    className="text-xs text-gray-600 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-gray-700"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Step 2: Merge options */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          2. Merge Options
        </h2>

        <div className="space-y-4">
          {/* Normalize multiallelic */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5">
              <input
                type="checkbox"
                checked={mergeOptions.norm_multiallelic}
                onChange={(e) =>
                  setMergeOptions((prev) => ({
                    ...prev,
                    norm_multiallelic: e.target.checked,
                  }))
                }
                className="sr-only peer"
              />
              <div className="w-5 h-5 border-2 border-gray-600 rounded peer-checked:bg-violet-600 peer-checked:border-violet-600 transition-colors flex items-center justify-center">
                {mergeOptions.norm_multiallelic && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-200">Normalize multiallelic sites before merge</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Runs <code className="text-violet-400 bg-gray-800 px-1 rounded">bcftools norm -m +any</code> on each
                file prior to merging to split multiallelic sites.
              </p>
            </div>
          </label>

          {/* Output filename */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              Output filename
            </label>
            <input
              type="text"
              value={mergeOptions.output_filename}
              onChange={(e) =>
                setMergeOptions((prev) => ({
                  ...prev,
                  output_filename: e.target.value,
                }))
              }
              placeholder="merged.vcf.gz"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-violet-600 focus:border-transparent"
            />
            <p className="text-xs text-gray-600 mt-1">Will be saved as a bgzipped VCF (.vcf.gz)</p>
          </div>
        </div>
      </div>

      {/* Step 3: Submit */}
      <div className="card flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-200">Ready to merge?</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {uploadedFiles.length < 2
              ? `Upload at least 2 files to enable merging (${uploadedFiles.length} uploaded)`
              : `${uploadedFiles.length} files queued for merge`}
          </p>
        </div>
        <button
          onClick={handleSubmitMerge}
          disabled={uploadedFiles.length < 2 || isRunning || isDone}
          className="btn-primary"
        >
          {isRunning && (jobStatus === 'submitting' || jobStatus === 'pending' || jobStatus === 'running') ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              Merging…
            </>
          ) : isDone ? (
            <>
              <CheckCircle size={15} />
              Completed
            </>
          ) : (
            <>
              <GitMerge size={15} />
              Merge VCFs
            </>
          )}
        </button>
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

      {/* Running indicator */}
      {isRunning && !uploading && (
        <div className="flex items-center gap-3 bg-violet-950/40 border border-violet-800 rounded-xl px-5 py-4">
          <Loader2 size={18} className="text-violet-400 animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-violet-300">
              {jobStatus === 'submitting' ? 'Submitting merge job…' : 'Merging VCF files…'}
            </p>
            {jobId && (
              <p className="text-xs text-violet-500 mt-0.5">
                Job ID: {jobId} — Status: {jobStatus}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Results card */}
      {isDone && mergeResult && (
        <div className="card space-y-5">
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
            Merge Complete
          </h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="stat-card">
              <p className="text-xs text-gray-500">Input Files</p>
              <p className="text-2xl font-bold text-white">{mergeResult.input_file_count}</p>
            </div>
            <div className="stat-card">
              <p className="text-xs text-gray-500">Merge Warnings</p>
              <p className={`text-2xl font-bold ${mergeResult.merge_warnings > 0 ? 'text-yellow-400' : 'text-white'}`}>
                {mergeResult.merge_warnings}
              </p>
            </div>
            <div className="stat-card col-span-2">
              <p className="text-xs text-gray-500">Output File</p>
              <p className="text-sm text-gray-200 font-mono truncate mt-1">
                {mergeResult.output_file.split('/').pop() ?? mergeResult.output_file}
              </p>
            </div>
          </div>

          {mergeResult.warning_messages.length > 0 && (
            <div className="bg-yellow-950/40 border border-yellow-800 rounded-lg px-4 py-3">
              <p className="text-xs font-semibold text-yellow-400 mb-2">Merge Warnings</p>
              <ul className="space-y-1">
                {mergeResult.warning_messages.map((w, i) => (
                  <li key={i} className="text-xs text-yellow-300 font-mono">
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-gray-800">
            <div>
              <p className="text-sm font-medium text-gray-200">Download Merged VCF</p>
              <p className="text-xs text-gray-500 mt-0.5">bgzip-compressed VCF file</p>
            </div>
            <button onClick={handleDownload} className="btn-secondary">
              <Download size={15} />
              Download .vcf.gz
            </button>
          </div>
        </div>
      )}

      {/* HPC / SLURM section — shown after completion */}
      {isDone && (
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
                For large datasets, run the merge on MSI with{' '}
                <code className="text-violet-400 bg-gray-800 px-1 rounded">sbatch script.sh</code>.
                Download a pre-configured SLURM script below.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <a
                  href={`${API_BASE}/api/slurm/script/merge?file_ids=${encodeURIComponent(uploadedFiles.map((f) => f.file_id).join(','))}&norm_multiallelic=${mergeOptions.norm_multiallelic}&output_filename=${encodeURIComponent(mergeOptions.output_filename)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-xs"
                >
                  <Download size={13} />
                  Download SLURM Script
                </a>
                <span className="text-xs text-gray-600">
                  Copy to MSI and run: <code className="text-gray-400">sbatch varianttools_merge.sh</code>
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
