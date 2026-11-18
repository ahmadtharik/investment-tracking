/** Says when values use saved balances or older prices because live quotes weren't available. */
export function PriceNotice() {
  return <p role="status" className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">Live prices aren&apos;t available right now, so some values use your saved balances or older prices. They&apos;ll update when prices are back.</p>;
}
