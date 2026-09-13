export type FxProviderKey = 'TD' | 'WEALTHSIMPLE' | 'CUSTOM';

/** rate = mid USD per 1 CAD (e.g. 1.35 means C$1 = US$0.74) */
export interface FxProviderConfig {
  provider: FxProviderKey;
  rate: number;
}

export interface FxResult {
  usdReceived: number;
  fxCostCad: number;
  effectiveRate: number;
}

/**
 * Provider spreads (fraction of USD value lost to the FX markup).
 * TD ~1.5% spot spread; Wealthsimple ~1.4% FX markup (both approximate —
 * the /fx page lets users override with a custom rate).
 */
export const FX_SPREADS: Record<FxProviderKey, number> = {
  TD: 0.015,
  WEALTHSIMPLE: 0.014,
  CUSTOM: 0,
};

export function convertCadToUsd(cadAmount: number, midRateUsdPerCad: number, config: FxProviderConfig): FxResult {
  const spread = FX_SPREADS[config.provider];
  const rate = config.rate > 0 ? config.rate : midRateUsdPerCad;
  const usdReceived = (cadAmount / rate) * (1 - spread);
  return {
    usdReceived,
    fxCostCad: cadAmount - usdReceived * rate,
    effectiveRate: usdReceived > 0 ? cadAmount / usdReceived : rate,
  };
}

export function annualFxCost(monthlyCadToUsd: number, midRateUsdPerCad: number, config: FxProviderConfig) {
  const oneMonth = convertCadToUsd(monthlyCadToUsd, midRateUsdPerCad, config);
  return {
    monthlyCost: oneMonth.fxCostCad,
    annualCost: oneMonth.fxCostCad * 12,
    annualUsdReceived: oneMonth.usdReceived * 12,
  };
}