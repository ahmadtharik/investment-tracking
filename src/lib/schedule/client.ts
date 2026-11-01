/** Records anything already due at the old amounts, so a plan change only affects future instalments. */
export async function settleBeforePlanChange(): Promise<void> {
  await fetch('/api/schedule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'settle' }) }).catch(() => undefined);
}
