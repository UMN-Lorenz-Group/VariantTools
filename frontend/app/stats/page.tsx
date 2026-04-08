'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle,
  AlertCircle,
  Loader2,
  Download,
  Database,
  Dna,
} from 'lucide-react';
import { clsx } from 'clsx';
import FileUpload from '@/components/FileUpload';
import { SubstitutionTypeChart, PerSampleMissingChart } from '@/components/StatsChart';
import type {
  SubstitutionTypeDatum,
  PerSampleDatum,
} from '@/components/StatsChart';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AssemblyInfo {
  assembly_guess: string | null;
  reference: string | null;
  file_format: string | null;
  contig_count: number;
  recognized: boolean;
}

interface StatsSummary {
  [key: string]: number | string;
}

interface StatsResult {
  summary: StatsSummary;
  substitution_types: SubstitutionTypeDatum[];
  per_sample: PerSampleDatum[];
}

interface UploadResponse {
  job_id: string;
  assembly_info: AssemblyInfo;
  status: string;
}

interface PollResponse {
  job_id: string;
  status: string;
  error_message: string | null;
  stats: StatsResult | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

function formatNumber(val: number | string | undefined): string {
  if (val === undefined || val === null) return '—';
  const n = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(n)) return String(val);
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toFixed(4);
}

function getSummaryValue(summary: StatsSummary, ...keys: string[]): number | string | undefined {
  for (const key of keys) {
    if (summary[key] !== undefined) return summary[key];
    // try case-insensitive match
    const found = Object.keys(summary).find(
      (k) => k.toLowerCase().includes(key.toLowerCase())
    );
    if (found) return summary[found];
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function StatsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string>('idle');
  const [statsResult, setStatsResult] = useState<StatsResult | null>(null);
  const [assemblyInfo, setAssemblyInfo] = useState<AssemblyInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Stop polling
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current !== null) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  // Poll job status
  const pollJob = useCallback(
    async (id: string) => {
      try {
        const res = await fetch(`${API_BASE}/api/stats/result/${id}`);
        if (!res.ok) {
          stopPolling();
          setError(`Polling error: ${res.status} ${res.statusText}`);
          return;
        }
        const data: PollResponse = await res.json();
        setJobStatus(data.status);

        if (data.status === 'completed') {
          stopPolling();
          if (data.stats) setStatsResult(data.stats);
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

  // Cleanup on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleFileSelected = (files: File[]) => {
    setFile(files[0] ?? null);
    // Reset state when a new file is chosen
    setJobId(null);
    setJobStatus('idle');
    setStatsResult(null);
    setAssemblyInfo(null);
    setError(null);
    stopPolling();
  };

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    setJobStatus('uploading');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${API_BASE}/api/stats/upload-and-analyze`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? `Upload failed: ${res.status}`);
      }

      const data: UploadResponse = await res.json();
      setJobId(data.job_id);
      setAssemblyInfo(data.assembly_info);
      setJobStatus('pending');

      // Start polling every 2 seconds
      pollIntervalRef.current = setInterval(() => pollJob(data.job_id), 2000);
    } catch (err) {
      setError(String(err));
      setJobStatus('failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = () => {
    if (!jobId) return;
    window.open(`${API_BASE}/api/stats/download/${jobId}`, '_blank');
  };

  const isRunning = jobStatus === 'pending' || jobStatus === 'running' || uploading;
  const isDone = jobStatus === 'completed';
  const isFailed = jobStatus === 'failed';

  // Extract key stats
  const snpCount = statsResult
    ? getSummaryValue(statsResult.summary, 'number of SNPs', 'SNPs')
    : undefined;
  const sampleCount = statsResult
    ? getSummaryValue(statsResult.summary, 'number of samples', 'samples')
    : undefined;
  const indelCount = statsResult
    ? getSummaryValue(statsResult.summary, 'number of indels', 'indels')
    : undefined;
  const tstvRatio = statsResult
    ? getSummaryValue(statsResult.summary, 'Ts/Tv', 'ts/tv', 'tstv')
    : undefined;

  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Dna size={22} className="text-blue-400" />
          VCF Stats &amp; Assembly Detection
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Upload a VCF file to detect the reference assembly and compute detailed statistics.
        </p>
      </div>

      {/* Upload card */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
          1. Upload VCF File
        </h2>
        <FileUpload
          accept=".vcf,.vcf.gz"
          multiple={false}
          onFiles={handleFileSelected}
          label="Drop VCF file here or click to browse"
          description="Supports .vcf and .vcf.gz"
        />

        {file && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Selected: <span className="text-gray-200 font-medium">{file.name}</span>
            </p>
            <button
              onClick={handleSubmit}
              disabled={isRunning || isDone}
              className="btn-primary"
            >
              {isRunning ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Analyzing…
                </>
              ) : isDone ? (
                <>
                  <CheckCircle size={15} />
                  Completed
                </>
              ) : (
                <>
                  <Database size={15} />
                  Analyze VCF
                </>
              )}
            </button>
          </div>
        )}
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

      {/* Assembly Detection card — shown immediately after upload */}
      {assemblyInfo && (
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
            2. Assembly Detection
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <p className="text-xs text-gray-500 mb-1">Detected Assembly</p>
              <span
                className={clsx(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold',
                  assemblyInfo.recognized
                    ? 'bg-green-900/50 text-green-300 border border-green-700'
                    : 'bg-yellow-900/50 text-yellow-300 border border-yellow-700'
                )}
              >
                {assemblyInfo.recognized ? (
                  <CheckCircle size={13} />
                ) : (
                  <AlertCircle size={13} />
                )}
                {assemblyInfo.assembly_guess ?? 'Unknown'}
              </span>
            </div>

            <div className="flex-1 min-w-[200px]">
              <p className="text-xs text-gray-500 mb-1">##fileformat</p>
              <p className="text-sm text-gray-200">{assemblyInfo.file_format ?? '—'}</p>
            </div>

            <div className="flex-1 min-w-[200px]">
              <p className="text-xs text-gray-500 mb-1">##reference</p>
              <p className="text-sm text-gray-200 truncate max-w-xs" title={assemblyInfo.reference ?? ''}>
                {assemblyInfo.reference ?? '(not set)'}
              </p>
            </div>

            <div className="flex-1 min-w-[120px]">
              <p className="text-xs text-gray-500 mb-1">Contig lines</p>
              <p className="text-sm text-gray-200">{assemblyInfo.contig_count}</p>
            </div>
          </div>
        </div>
      )}

      {/* Running indicator */}
      {isRunning && !isDone && (
        <div className="flex items-center gap-3 bg-blue-950/40 border border-blue-800 rounded-xl px-5 py-4">
          <Loader2 size={18} className="text-blue-400 animate-spin flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-300">
              {jobStatus === 'uploading' ? 'Uploading file…' : 'Running bcftools stats…'}
            </p>
            <p className="text-xs text-blue-500 mt-0.5">
              Job ID: {jobId} — Status: {jobStatus}
            </p>
          </div>
        </div>
      )}

      {/* Stats Summary cards */}
      {isDone && statsResult && (
        <>
          <div className="card">
            <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
              3. Statistics Summary
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat-card">
                <p className="text-xs text-gray-500">Number of SNPs</p>
                <p className="text-2xl font-bold text-white">{formatNumber(snpCount)}</p>
              </div>
              <div className="stat-card">
                <p className="text-xs text-gray-500">Number of Samples</p>
                <p className="text-2xl font-bold text-white">{formatNumber(sampleCount)}</p>
              </div>
              <div className="stat-card">
                <p className="text-xs text-gray-500">Number of Indels</p>
                <p className="text-2xl font-bold text-white">{formatNumber(indelCount)}</p>
              </div>
              <div className="stat-card">
                <p className="text-xs text-gray-500">Ts/Tv Ratio</p>
                <p className="text-2xl font-bold text-white">{formatNumber(tstvRatio)}</p>
              </div>
            </div>
          </div>

          {/* Substitution Types chart */}
          {statsResult.substitution_types.length > 0 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
                4. Substitution Types
              </h2>
              <SubstitutionTypeChart data={statsResult.substitution_types} />
            </div>
          )}

          {/* Per-sample missing data */}
          {statsResult.per_sample.length > 0 && statsResult.per_sample.length <= 50 && (
            <div className="card">
              <h2 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wide">
                5. Per-sample Missing Data
              </h2>
              {statsResult.per_sample.length > 20 ? (
                // Table view for many samples
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-gray-300">
                    <thead>
                      <tr className="text-left text-xs text-gray-500 border-b border-gray-800">
                        <th className="pb-2 pr-4">Sample</th>
                        <th className="pb-2 pr-4">Hom Ref</th>
                        <th className="pb-2 pr-4">Het</th>
                        <th className="pb-2 pr-4">Hom Alt</th>
                        <th className="pb-2">Missing</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statsResult.per_sample.map((s) => (
                        <tr key={s.sample_id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                          <td className="py-1.5 pr-4 font-mono text-xs">{s.sample_id}</td>
                          <td className="py-1.5 pr-4">{s.hom_RR.toLocaleString()}</td>
                          <td className="py-1.5 pr-4">{s.het.toLocaleString()}</td>
                          <td className="py-1.5 pr-4">{s.hom_AA.toLocaleString()}</td>
                          <td className="py-1.5">{s.missing.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <PerSampleMissingChart data={statsResult.per_sample} />
              )}
            </div>
          )}

          {/* Download */}
          <div className="card flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-200">Download Raw Stats</p>
              <p className="text-xs text-gray-500 mt-0.5">
                Full bcftools stats text output for this job
              </p>
            </div>
            <button onClick={handleDownload} className="btn-secondary">
              <Download size={15} />
              Download .txt
            </button>
          </div>
        </>
      )}
    </div>
  );
}
