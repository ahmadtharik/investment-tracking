'use client';

import { useId, useState, type ReactNode } from 'react';

export function InfoTooltip({ children, label = 'More information' }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return <span className="relative inline-flex align-middle" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}><button type="button" aria-label={label} aria-describedby={open ? id : undefined} onClick={() => setOpen((value) => !value)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} className="inline-flex h-4 w-4 items-center justify-center rounded-full text-xs font-semibold text-[var(--accent)] hover:bg-[#e8f1f6] focus:outline-none focus:ring-2 focus:ring-[#dcecf7]">i</button>{open && <span id={id} role="tooltip" className="absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-lg border border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-left text-xs font-normal normal-case tracking-normal text-[var(--ink)] shadow-lg">{children}</span>}</span>;
}
