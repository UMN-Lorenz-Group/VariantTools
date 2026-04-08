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

const navItems: NavItem[] = [
  { label: 'Home', href: '/', icon: <Home size={18} /> },
  { label: 'Stats & Assembly', href: '/stats', icon: <BarChart2 size={18} /> },
  { label: 'Liftover', href: '/liftover', icon: <ArrowUpDown size={18} /> },
  { label: 'Fix Reference', href: '/fixref', icon: <Wrench size={18} /> },
  { label: 'Merge VCFs', href: '/merge', icon: <GitMerge size={18} /> },
  { label: 'VCF Generator', href: '/generator', icon: <FilePlus2 size={18} /> },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col h-full">
      {/* Logo / Title */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-800">
        <div className="flex-shrink-0 w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
          <Dna size={16} className="text-white" />
        </div>
        <div>
          <p className="text-sm font-bold text-white leading-tight">VariantTools</p>
          <p className="text-xs text-gray-400 leading-tight">Genomics Suite</p>
        </div>
      </div>

      {/* Nav links */}
      <ul className="flex flex-col gap-1 px-3 py-4 flex-1">
        {navItems.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          if (item.disabled) {
            return (
              <li key={item.href}>
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
              </li>
            );
          }

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors',
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 font-medium'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
                )}
              >
                <span
                  className={clsx(
                    'flex-shrink-0',
                    isActive ? 'text-blue-400' : 'text-gray-500'
                  )}
                >
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-800">
        <p className="text-xs text-gray-600">Phase 3 — v0.3.0</p>
      </div>
    </nav>
  );
}
