'use client';

import { Link2, X } from 'lucide-react';
import { usePipeline } from '@/context/PipelineContext';

const SOURCE_LABELS: Record<string, string> = {
  load: 'Loaded',
  generate: 'Generated',
  fixref: 'FixRef output',
  liftover: 'Liftover output',
};

export default function PipelineBanner() {
  const { pipelineVcf, clearPipelineVcf } = usePipeline();
  if (!pipelineVcf) return null;

  return (
    <div className="flex items-center gap-3 bg-blue-950/50 border-b border-blue-800/60 px-6 py-2.5 flex-shrink-0">
      <Link2 size={14} className="text-blue-400 flex-shrink-0" />
      <span className="text-xs text-blue-300 flex items-center gap-2 flex-wrap">
        <span className="font-medium text-blue-200">Pipeline VCF:</span>
        <span className="font-mono text-blue-100">{pipelineVcf.filename}</span>
        {pipelineVcf.sample_count != null && (
          <span className="text-blue-400">{pipelineVcf.sample_count.toLocaleString()} samples</span>
        )}
        {pipelineVcf.assembly && (
          <span className="bg-blue-900/60 text-blue-300 border border-blue-700 px-2 py-0.5 rounded text-xs">
            {pipelineVcf.assembly}
          </span>
        )}
        <span className="text-blue-600">
          from {SOURCE_LABELS[pipelineVcf.source] ?? pipelineVcf.source}
        </span>
      </span>
      <button
        onClick={clearPipelineVcf}
        className="ml-auto text-blue-700 hover:text-blue-400 transition-colors flex-shrink-0"
        title="Clear pipeline VCF"
      >
        <X size={14} />
      </button>
    </div>
  );
}
