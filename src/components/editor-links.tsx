'use client';

import { useEffect } from 'react';

/** Expand details before focusing a deep link, including same-page navigation. */
export function EditorLinks() {
  useEffect(() => {
    const reveal = () => {
      const id = window.location.hash.slice(1);
      if (!id) return;
      if (window.location.pathname === '/accounts' && ['manage','tfsaRoom','rrspRoom','contributionAmount'].includes(id)) { window.location.replace(`/accounts/manage#${id === 'manage' ? 'contribution-room' : id}`); return; }
      const target = document.getElementById(id);
      if (!target) return;
      const details = target.closest('details');
      if (details) details.open = true;
      target.scrollIntoView({ block: 'start' });
      if (target instanceof HTMLInputElement) target.focus({ preventScroll: true });
    };
    reveal();
    window.addEventListener('hashchange', reveal);
    return () => window.removeEventListener('hashchange', reveal);
  }, []);
  return null;
}
