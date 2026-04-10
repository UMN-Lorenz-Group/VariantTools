import Link from 'next/link';
import {
  FilePlus2,
  BarChart2,
  Wrench,
  ArrowUpDown,
  GitMerge,
  ArrowRight,
} from 'lucide-react';

interface PipelineStep {
  step: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: string;
  iconBg: string;
}

const pipelineSteps: PipelineStep[] = [
  {
    step: 1,
    title: 'Load / Generate VCF',
    description:
      'Load an existing VCF and check its integrity, or generate a new VCF from DArTag, Agriplex, or dosage matrix genotype data.',
    icon: <FilePlus2 size={22} />,
    href: '/generator',
    color: 'border-green-700 hover:border-green-500',
    iconBg: 'bg-green-600/20 text-green-400',
  },
  {
    step: 2,
    title: 'Stats & Assembly',
    description:
      'Detect the reference assembly, run bcftools stats, and inspect SNP/indel counts, substitution types, and per-sample missing data.',
    icon: <BarChart2 size={22} />,
    href: '/stats',
    color: 'border-blue-700 hover:border-blue-500',
    iconBg: 'bg-blue-600/20 text-blue-400',
  },
  {
    step: 3,
    title: 'Fix Reference',
    description:
      'Fix REF allele mismatches against a reference FASTA using bcftools +fixref. Compare before/after mismatch rates.',
    icon: <Wrench size={22} />,
    href: '/fixref',
    color: 'border-orange-700 hover:border-orange-500',
    iconBg: 'bg-orange-600/20 text-orange-400',
  },
  {
    step: 4,
    title: 'Liftover',
    description:
      'Lift over variants between genome assemblies using CrossMap chain files. View mapped/unmapped counts and download results.',
    icon: <ArrowUpDown size={22} />,
    href: '/liftover',
    color: 'border-teal-700 hover:border-teal-500',
    iconBg: 'bg-teal-600/20 text-teal-400',
  },
  {
    step: 5,
    title: 'Fix Reference (QC)',
    description:
      'Run a final FixRef pass on the liftover output to ensure all REF/ALT calls are correct against the target assembly.',
    icon: <Wrench size={22} />,
    href: '/fixref',
    color: 'border-yellow-700 hover:border-yellow-500',
    iconBg: 'bg-yellow-600/20 text-yellow-400',
  },
];

export default function HomePage() {
  return (
    <div className="p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white mb-2">VariantTools</h1>
        <p className="text-gray-400 text-lg">Genomics Variant Processing Pipeline</p>
        <p className="text-gray-500 text-sm mt-1">
          A linear pipeline for generating, QC-ing, and lifting over VCF files.
          Use the <span className="text-blue-400">Pipeline VCF</span> banner to
          pass files between steps without re-uploading.
        </p>
      </div>

      {/* Pipeline flow */}
      <div className="space-y-3 mb-10">
        {pipelineSteps.map((step, idx) => (
          <div key={step.step} className="flex items-stretch gap-3">
            {/* Step card */}
            <Link
              href={step.href}
              className={`flex-1 bg-gray-900 border rounded-xl p-5 flex items-start gap-4 transition-colors ${step.color}`}
            >
              {/* Step number */}
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center">
                <span className="text-xs font-bold text-gray-400">{step.step}</span>
              </div>
              {/* Icon */}
              <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${step.iconBg}`}>
                {step.icon}
              </div>
              {/* Content */}
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-semibold text-white mb-0.5">{step.title}</h2>
                <p className="text-xs text-gray-400 leading-relaxed">{step.description}</p>
              </div>
              <ArrowRight size={16} className="flex-shrink-0 text-gray-600 self-center" />
            </Link>
          </div>
        ))}
      </div>

      {/* Utilities */}
      <div className="border-t border-gray-800 pt-8">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Utilities</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/merge"
            className="bg-gray-900 border border-violet-700 hover:border-violet-500 rounded-xl p-5 flex items-start gap-4 transition-colors"
          >
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-violet-600/20 text-violet-400 flex items-center justify-center">
              <GitMerge size={22} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white mb-0.5">Merge VCFs</h2>
              <p className="text-xs text-gray-400">
                Merge multiple VCF files across samples with optional multiallelic normalization.
              </p>
            </div>
          </Link>
        </div>
      </div>

      <p className="mt-10 text-xs text-gray-700 text-center">
        VariantTools v0.4.0 — Pipeline mode active
      </p>
    </div>
  );
}
