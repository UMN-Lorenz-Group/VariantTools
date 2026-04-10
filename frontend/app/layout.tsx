import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import NavBar from '@/components/NavBar';
import AppProviders from '@/components/AppProviders';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'VariantTools',
  description: 'Genomics Variant Processing Tools',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen bg-gray-950 font-sans">
        {/* Sidebar */}
        <aside className="fixed inset-y-0 left-0 z-30 w-60 bg-gray-900 border-r border-gray-800 flex flex-col">
          <NavBar />
        </aside>

        {/* Main content offset by sidebar width */}
        <main className="flex-1 ml-60 min-h-screen overflow-auto flex flex-col">
          <AppProviders>{children}</AppProviders>
        </main>
      </body>
    </html>
  );
}
