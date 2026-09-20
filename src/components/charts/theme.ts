'use client';

/**
 * Categorical series colors — validated by the dataviz palette checks
 * (light surface #ffffff, dark surface #09090b). Fixed order: slot 1 blue,
 * slot 2 orange, slot 3 aqua. Accounts always keep their hue regardless of
 * which charts they appear in.
 */
export const SERIES = {
  TFSA: { light: '#2563EB', dark: '#3B82F6' },
  RRSP: { light: '#F97316', dark: '#FB923C' },
  CASH: { light: '#22C55E', dark: '#4ADE80' },
} as const;

/** Chart ink for the app's deliberately light, calm workspace. */
export function useChartColors() {
  return {
    TFSA: SERIES.TFSA.light,
    RRSP: SERIES.RRSP.light,
    CASH: SERIES.CASH.light,
    text: '#334155',
    grid: '#E2E8F0',
    axis: '#64748B',
  };
}
