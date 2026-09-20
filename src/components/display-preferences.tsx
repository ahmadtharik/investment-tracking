'use client';
import { useEffect } from 'react';

export function DisplayPreferences({ userId }: { userId: string }) {
  useEffect(() => {
    const system = window.matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      let value: { theme?: string; compact?: boolean } = {};
      try { value = JSON.parse(localStorage.getItem(`investment-planner:ui-preferences:${userId}`) || '{}'); } catch { /* Use defaults when storage is unavailable. */ }
      document.documentElement.classList.toggle('app-dark', value.theme === 'dark' || (value.theme === 'system' && system.matches));
      document.documentElement.classList.toggle('app-compact', value.compact === true);
    };
    apply();
    window.addEventListener('display-preferences-changed', apply);
    window.addEventListener('storage', apply);
    system.addEventListener('change', apply);
    return () => { window.removeEventListener('display-preferences-changed', apply); window.removeEventListener('storage', apply); system.removeEventListener('change', apply); document.documentElement.classList.remove('app-dark', 'app-compact'); };
  }, [userId]);
  return null;
}
