const cad = new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 });
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

export function formatCAD(n: number) {
  return cad.format(n);
}

export function formatUSD(n: number) {
  return usd.format(n);
}

/** 0.6 → "60%", 0.125 → "12.5%" */
export function formatPct(fraction: number) {
  return `${Math.round(fraction * 1000) / 10}%`;
}