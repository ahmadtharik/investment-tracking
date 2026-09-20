import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { addContribution, saveAccountAllocations, saveProfile } from '../../lib/db/queries';

describe('safe data writes', () => {
  it('updates only the supplied profile fields for the current user', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    await saveProfile({ from } as unknown as SupabaseClient, 'owner', { tfsa_room: 500 });
    expect(update).toHaveBeenCalledWith({ tfsa_room: 500 });
    expect(eq).toHaveBeenCalledWith('id', 'owner');
  });
  it('upserts allocations without deleting the existing plan first', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ upsert });
    await saveAccountAllocations({ from } as unknown as SupabaseClient, 'owner', [
      { account: 'TFSA', pct: .6 }, { account: 'RRSP', pct: .2 }, { account: 'CASH', pct: .2 },
    ]);
    expect(upsert).toHaveBeenCalledOnce();
    expect(upsert.mock.calls[0][1]).toEqual({ onConflict: 'user_id,account' });
  });
  it('rejects invalid allocations before any request', async () => {
    const from = vi.fn();
    await expect(saveAccountAllocations({ from } as unknown as SupabaseClient, 'owner', [
      { account: 'TFSA', pct: .8 }, { account: 'RRSP', pct: .8 }, { account: 'CASH', pct: .2 },
    ])).rejects.toThrow('100%');
    expect(from).not.toHaveBeenCalled();
  });
  it('accepts decimal cents and uses the atomic contribution function', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { remainingRoom: 98.9 }, error: null });
    const from = vi.fn();
    await expect(addContribution({ rpc, from } as unknown as SupabaseClient, 'owner', {
      instrument_id: null, fx_provider: null, fx_rate: null, fx_cost_cad: null, amount_native: null,
      account: 'TFSA', amount_cad: 1.1, contributed_on: '2026-09-19',
    })).resolves.toEqual({ remainingRoom: 98.9 });
    expect(from).not.toHaveBeenCalled();
  });
  it('never retries a failed transaction using separate writes', async () => {
    const error = { code: 'P0001', message: 'Contribution exceeds available room' };
    const rpc = vi.fn().mockResolvedValue({ data: null, error });
    const from = vi.fn();
    await expect(addContribution({ rpc, from } as unknown as SupabaseClient, 'owner', {
      instrument_id: null, fx_provider: null, fx_rate: null, fx_cost_cad: null, amount_native: null,
      account: 'TFSA', amount_cad: 100, contributed_on: '2026-09-19',
    })).rejects.toEqual(error);
    expect(from).not.toHaveBeenCalled();
  });
});
