'use client';

import { useEffect } from 'react';

/** Last-resort page when the root layout itself fails, so it brings its own html and styles. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <html lang="en">
    <body style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '6rem 1rem', color: '#0f172a' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Something went wrong</h1>
      <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#64748b' }}>We couldn&apos;t load this page. Your saved information hasn&apos;t changed.</p>
      <button type="button" onClick={reset} style={{ marginTop: '1.25rem', padding: '0.5rem 0.875rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer' }}>Try again</button>
    </body>
  </html>;
}
