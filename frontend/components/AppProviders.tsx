'use client';

import { PipelineProvider } from '@/context/PipelineContext';
import PipelineBanner from '@/components/PipelineBanner';

export default function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <PipelineProvider>
      <PipelineBanner />
      <div className="flex-1">{children}</div>
    </PipelineProvider>
  );
}
