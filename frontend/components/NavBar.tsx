'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  BarChart2,
  ArrowUpDown,
  Wrench,
  GitMerge,
  FilePlus2,
  Dna,
} from 'lucide-react';
import { clsx } from 'clsx';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  disabled?: boolean;
}

const pipelineItems: NavItem[] = [
  { label: 'Home', href: '/', icon: <Home size={18} /> },
  { label: 'Load / Generate VCF', href: '/generator', icon: <FilePlus2 size={18} /> },
  { label: 'Stats & Assembly', href: '/stats', icon: <BarChart2 size={18} /> },
  { label: 'Fix Reference', href: '/fixref', icon: <Wrench size={18} /> },
  { label: 'Liftover', href: '/liftover', icon: <ArrowUpDown size={18} /> },
];

const utilityItems: NavItem[] = [
  { label: 'Merge VCFs', href: '/merge', icon: <GitMerge size={18} /> },
];

function NavLink({ item, isActive }: { item: NavItem; isActive: boolean }) {
  if (item.disabled) {
    return (
      <span
        className={clsx(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm',
          'text-gray-600 cursor-not-allowed select-none'
        )}
      >
        <span className="flex-shrink-0 text-gray-700">{item.icon}</span>
        <span>{item.label}</span>
        <span className="ml-auto text-xs bg-gray-800 text-gray-600 px-1.5 py-0.5 rounded">
          Soon
        </span>
      </span>
    );
  }

  return (
    <Link
      href={item.href}
      className={clsx(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
        isActive
          ? 'bg-blue-600/20 text-blue-400 font-medium'
          : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
      )}
    >
      <span className={clsx('flex-shrink-0', isActive ? 'text-blue-400' : 'text-gray-500')}>
        {item.icon}
      </span>
      <span>{item.label}</span>
    </Link>
  );
}

export default function NavBar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <nav className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-800">
        <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <Dna size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">VariantTools</p>
          <p className="text-xs text-gray-400 leading-tight">Genomics Suite</p>
        </div>
      </div>

      {/* Pipeline section */}
      <div className="flex flex-col px-3 pt-4 flex-1">
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider px-3 mb-2">
          Pipeline
        </p>
        <ul className="flex flex-col gap-1 mb-4">
          {pipelineItems.map((item) => (
            <li key={item.href}>
              <NavLink item={item} isActive={isActive(item.href)} />
            </li>
          ))}
        </ul>

        {/* Utilities divider */}
        <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider px-3 mb-2 mt-2 border-t border-gray-800 pt-4">
          Utilities
        </p>
        <ul className="flex flex-col gap-1">
          {utilityItems.map((item) => (
            <li key={item.href}>
              <NavLink item={item} isActive={isActive(item.href)} />
            </li>
          ))}
        </ul>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-800">
        <p className="text-xs text-gray-600">Pipeline v0.4.0</p>
      </div>
    </nav>
  );
}
