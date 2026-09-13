'use client';

import { useEffect, useState } from 'react';

/**
 * Categorical series colors — validated by the dataviz palette checks
 * (light surface #ffffff, dark surface #09090b). Fixed order: slot 1 blue,
 * slot 2 orange, slot 3 aqua. Accounts always keep their hue regardless of
 * which charts they appear in.
 */
export const SERIES = {
  TFSA: { light: '#2a78d6', dark: '#3987e5' },
  RRSP: { light: '#eb6834', dark: '#d95926' },
  CASH: { light: '#1baf7a', dark: '#199e70' },
} as const;

/** Chart ink: picks light/dark steps of the validated reference palette. */
export function useChartColors() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => setDark(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return {
    TFSA: dark ? SERIES.TFSA.dark : SERIES.TFSA.light,
    RRSP: dark ? SERIES.RRSP.dark : SERIES.RRSP.light,
    CASH: dark ? SERIES.CASH.dark : SERIES.CASH.light,
    text: dark ? '#c3c2b7' : '#52514e',
    grid: dark ? '#2c2c2a' : '#e1e0d9',
    axis: '#898781',
  };
}