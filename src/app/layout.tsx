import type { Metadata } from 'next';
import './globals.css';
import { siteUrl } from '@/lib/site';

const description = 'Plan your TFSA/RRSP contributions, track your portfolio, and project your future.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: 'Investment Planner', template: '%s · Investment Planner' },
  description,
  openGraph: { type: 'website', siteName: 'Investment Planner', title: 'Investment Planner', description, images: [{ url: '/images/showcase/landing-page.png', alt: 'Investment Planner landing page' }] },
  twitter: { card: 'summary_large_image', title: 'Investment Planner', description, images: ['/images/showcase/landing-page.png'] },
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
