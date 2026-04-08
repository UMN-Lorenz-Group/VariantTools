import Link from 'next/link';
import {
  BarChart2,
  ArrowUpDown,
  Wrench,
  GitMerge,
  FilePlus2,
} from 'lucide-react';

interface ModuleCard {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  enabled: boolean;
  color: string;
  iconBg: string;
}

const modules: ModuleCard[] = [
  {
    title: 'VCF Stats & Assembly',
    description:
      'Analyze VCF files with bcftools stats. Detect reference assembly, view SNP/indel counts, substitution types, and per-sample missing data.',
    icon: <BarChart2 size={24} />,
    href: '/stats',
    enabled: true,
    color: 'border-blue-700 hover:border-blue-500',
    iconBg: 'bg-blue-600/20 text-blue-400',
  },
  {
    title: 'Liftover',
    description:
      'Lift over variants between genome assemblies using CrossMap or Picard. Supports soybean and human assemblies.',
    icon: <ArrowUpDown size={24} />,
    href: '/liftover',
    enabled: true,
    color: 'border-teal-700 hover:border-teal-500',
    iconBg: 'bg-teal-600/20 text-teal-400',
  },
  {
    title: 'Fix Reference',
    description:
      'Fix REF allele mismatches against a reference FASTA. Uses bcftools +fixref with flip/swap correction.',
    icon: <Wrench size={24} />,
    href: '/fixref',
    enabled: true,
    color: 'border-orange-700 hover:border-orange-500',
    iconBg: 'bg-orange-600/20 text-orange-400',
  },
  {
    title: 'Merge VCFs',
    description:
      'Merge multiple VCF files across samples. Optionally normalize multiallelic sites before merging.',
    icon: <GitMerge size={24} />,
    href: '/merge',
    enabled: true,
    color: 'border-violet-700 hover:border-violet-500',
    iconBg: 'bg-violet-600/20 text-violet-400',
  },
  {
    title: 'VCF Generator',
    description:
      'Generate VCF files from genotype dosage matrices (0/1/2 format). Translates to standard GT format (0/0, 0/1, 1/1) with configurable assembly and SNP metadata.',
    icon: <FilePlus2 size={24} />,
    href: '/generator',
    enabled: true,
    color: 'border-green-700 hover:border-green-500',
    iconBg: 'bg-green-600/20 text-green-400',
  },
];

export default function HomePage() {
  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-white mb-2">VariantTools</h1>
        <p className="text-gray-400 text-lg">Genomics Variant Processing Tools</p>
        <p className="text-gray-500 text-sm mt-1">
          A modular suite for VCF analysis, assembly detection, merging, and liftover.
        </p>
      </div>

      {/* Module grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {modules.map((mod) => (
          <div
            key={mod.href}
            className={`
              relative bg-gray-900 border rounded-xl p-6 flex flex-col gap-4
              transition-colors
              ${mod.color}
              ${!mod.enabled ? 'opacity-60' : ''}
            `}
          >
            {/* Coming soon badge */}
            {!mod.enabled && (
              <span className="absolute top-4 right-4 text-xs bg-gray-800 text-gray-500 px-2 py-0.5 rounded-full border border-gray-700">
                Coming soon
              </span>
            )}

            {/* Icon */}
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${mod.iconBg}`}>
              {mod.icon}
            </div>

            {/* Content */}
            <div className="flex-1">
              <h2 className="text-base font-semibold text-white mb-1">{mod.title}</h2>
              <p className="text-sm text-gray-400 leading-relaxed">{mod.description}</p>
            </div>

            {/* Action */}
            {mod.enabled ? (
              <Link
                href={mod.href}
                className="inline-flex items-center justify-center px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm font-medium rounded-lg transition-colors"
              >
                Open Module
              </Link>
            ) : (
              <button
                disabled
                className="inline-flex items-center justify-center px-4 py-2 bg-gray-800 text-gray-600 text-sm font-medium rounded-lg cursor-not-allowed"
              >
                Not available
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Footer note */}
      <p className="mt-10 text-xs text-gray-700 text-center">
        Phase 3 — VCF Generator live. Stats, Merge, Liftover, Fix Reference, and SLURM HPC integration active.
      </p>
    </div>
  );
}
