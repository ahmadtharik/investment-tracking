import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Investment Planner',
  description: 'Plan your TFSA/RRSP contributions, track your portfolio, and project your future.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[var(--surface-page)] text-[var(--text-body)] antialiased">
        {children}
      </body>
    </html>
  );
}
