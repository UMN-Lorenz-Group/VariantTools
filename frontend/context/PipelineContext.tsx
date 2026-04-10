'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';

export interface PipelineVCF {
  file_id: string;
  filename: string;
  sample_count?: number;
  assembly?: string;
  source: 'load' | 'generate' | 'fixref' | 'liftover';
}

interface PipelineContextValue {
  pipelineVcf: PipelineVCF | null;
  setPipelineVcf: (vcf: PipelineVCF) => void;
  clearPipelineVcf: () => void;
}

const PipelineContext = createContext<PipelineContextValue>({
  pipelineVcf: null,
  setPipelineVcf: () => {},
  clearPipelineVcf: () => {},
});

const STORAGE_KEY = 'varianttools_pipeline_vcf';

export function PipelineProvider({ children }: { children: React.ReactNode }) {
  const [pipelineVcf, setPipelineVcfState] = useState<PipelineVCF | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setPipelineVcfState(JSON.parse(stored));
    } catch {
      // ignore parse errors
    }
  }, []);

  const setPipelineVcf = useCallback((vcf: PipelineVCF) => {
    setPipelineVcfState(vcf);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(vcf)); } catch {}
  }, []);

  const clearPipelineVcf = useCallback(() => {
    setPipelineVcfState(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }, []);

  return (
    <PipelineContext.Provider value={{ pipelineVcf, setPipelineVcf, clearPipelineVcf }}>
      {children}
    </PipelineContext.Provider>
  );
}

export function usePipeline() {
  return useContext(PipelineContext);
}
