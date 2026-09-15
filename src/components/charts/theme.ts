'use client';

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

/** Chart ink for the app's deliberately light, calm workspace. */
export function useChartColors() {
  return {
    TFSA: SERIES.TFSA.light,
    RRSP: SERIES.RRSP.light,
    CASH: SERIES.CASH.light,
    text: '#52514e',
    grid: '#ebe8e1',
    axis: '#6f6b63',
  };
}
