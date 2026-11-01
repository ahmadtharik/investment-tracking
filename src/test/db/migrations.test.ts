import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

const USER = '00000000-0000-0000-0000-000000000001';
const OTHER = '00000000-0000-0000-0000-000000000002';
const MIGRATIONS = join(process.cwd(), 'src/db/migrations');
const TODAY = "(now() at time zone 'America/Toronto')::date";

let db: PGlite;

async function actAs(user: string | null) {
  await db.query(`select set_config('request.jwt.claims', $1, false)`, [user ? JSON.stringify({ sub: user }) : '']);
}
const room = async () => (await db.query<{ tfsa_room: string; rrsp_room: string }>(`select tfsa_room, rrsp_room from profiles where id = $1`, [USER])).rows[0];
const count = async (table: string) => Number((await db.query<{ n: string }>(`select count(*) as n from ${table} where user_id = $1`, [USER])).rows[0].n);
const holding = async () => (await db.query<{ units: string; balance_native: string; cost_cad: string | null }>(`select units, balance_native, cost_cad from holdings where user_id = $1 and instrument_id = 1`, [USER])).rows[0];
const line = (over: object = {}) => ({ account: 'TFSA', instrument_id: 1, amount_cad: 1000, contributed_on: '2026-11-01', units: 10, amount_native: 1000, price_native: 100, fx_rate: 1, ...over });
const resolve = (due: string, status: string, lines: object[], next: string, note: string | null = null) =>
  db.query<{ resolve_cycle: { applied: boolean; total?: number } }>(`select resolve_cycle($1::date, $2, $3::jsonb, $4::date, $5)`, [due, status, JSON.stringify(lines), next, note]).then((r) => r.rows[0].resolve_cycle);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
        (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid
    $$;
    create function auth.role() returns text language sql stable as $$ select 'authenticated'::text $$;
    grant usage on schema auth to anon, authenticated, service_role;
  `);
  for (const file of readdirSync(MIGRATIONS).sort()) await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
  await db.exec(`
    grant all on all tables in schema public to authenticated, anon, service_role;
    grant all on all sequences in schema public to authenticated, anon, service_role;
  `);
});

beforeEach(async () => {
  await actAs(null);
  await db.exec(`truncate auth.users cascade`);
  await db.query(`insert into auth.users values ($1), ($2)`, [USER, OTHER]);
  await db.query(`insert into profiles (id, tfsa_room, rrsp_room) values ($1, 5000, 3000), ($2, 5000, 3000)`, [USER, OTHER]);
  await db.query(`insert into contribution_schedules (user_id, day_of_month, next_due) values ($1, 15, '2026-11-15')`, [USER]);
  await actAs(USER);
});

describe('resolve_cycle', () => {
  it('records once and ignores a repeat for the same due date', async () => {
    expect((await resolve('2026-11-15', 'auto', [line()], '2026-12-15')).applied).toBe(true);
    expect((await resolve('2026-11-15', 'auto', [line()], '2026-12-15')).applied).toBe(false);
    expect(Number((await room()).tfsa_room)).toBe(4000);
    expect(await count('contributions')).toBe(1);
    expect(Number((await holding()).units)).toBe(10);
  });
  it('caps an automatic entry at the room and flags it', async () => {
    await resolve('2026-11-15', 'auto', [line({ amount_cad: 8000, units: 80, amount_native: 8000 })], '2026-12-15');
    expect(Number((await room()).tfsa_room)).toBe(0);
    const h = await holding();
    expect(Number(h.units)).toBeCloseTo(50);
    expect(Number(h.cost_cad)).toBe(5000);
    const cycle = (await db.query<{ note: string }>(`select note from contribution_cycles where user_id = $1`, [USER])).rows[0];
    expect(cycle.note).toContain('Reduced');
  });
  it('rejects a manual entry over the room and rolls everything back', async () => {
    await expect(resolve('2026-11-15', 'manual', [line({ amount_cad: 8000 })], '2026-12-15')).rejects.toThrow(/exceeds/);
    expect(await count('contribution_cycles')).toBe(0);
    expect(Number((await room()).tfsa_room)).toBe(5000);
  });
  it('records a skip without using room', async () => {
    await resolve('2026-11-15', 'skipped', [line()], '2026-12-15');
    expect(await count('contributions')).toBe(0);
    expect(Number((await room()).tfsa_room)).toBe(5000);
  });
});

describe('undo_cycle', () => {
  it('reopens a future instalment and restores room and units', async () => {
    const due = (await db.query<{ d: string }>(`select to_char(${TODAY} + 10, 'YYYY-MM-DD') as d`)).rows[0].d;
    await db.query(`update contribution_schedules set next_due = $1 where user_id = $2`, [due, USER]);
    await resolve(due, 'early', [line()], '2030-01-15');
    await db.query(`select undo_cycle($1::date)`, [due]);
    expect(Number((await room()).tfsa_room)).toBe(5000);
    expect(await holding()).toBeUndefined();
    expect(await count('contribution_cycles')).toBe(0);
    const next = (await db.query<{ d: string }>(`select to_char(next_due, 'YYYY-MM-DD') as d from contribution_schedules where user_id = $1`, [USER])).rows[0].d;
    expect(next).toBe(due);
  });
  it('leaves a past instalment skipped so it cannot record again', async () => {
    await db.query(`update contribution_schedules set next_due = '2020-01-15' where user_id = $1`, [USER]);
    await resolve('2020-01-15', 'auto', [line()], '2020-02-15');
    await db.query(`select undo_cycle('2020-01-15'::date)`);
    const cycle = (await db.query<{ status: string }>(`select status from contribution_cycles where user_id = $1`, [USER])).rows[0];
    expect(cycle.status).toBe('skipped');
    expect(Number((await room()).tfsa_room)).toBe(5000);
  });
});

describe('contributions', () => {
  it('needs consent to go over the room', async () => {
    await expect(db.query(`select record_purchase($1::jsonb)`, [JSON.stringify(line({ amount_cad: 6000 }))])).rejects.toThrow(/exceeds/);
    await db.query(`select record_purchase($1::jsonb)`, [JSON.stringify(line({ amount_cad: 6000, allow_over: true }))]);
    expect(Number((await room()).tfsa_room)).toBe(-1000);
  });
  it('keeps one holding per account and stock, adding to it', async () => {
    await db.query(`select record_purchase($1::jsonb)`, [JSON.stringify(line())]);
    await db.query(`select record_purchase($1::jsonb)`, [JSON.stringify(line())]);
    expect(await count('holdings')).toBe(1);
    const h = await holding();
    expect(Number(h.units)).toBe(20);
    expect(Number(h.cost_cad)).toBe(2000);
  });
  it('keeps an unknown cost unknown through a purchase and its removal', async () => {
    await db.query(`insert into holdings (user_id, instrument_id, account, units) values ($1, 1, 'TFSA', 5)`, [USER]);
    await db.query(`select record_purchase($1::jsonb)`, [JSON.stringify(line())]);
    expect((await holding()).cost_cad).toBeNull();
    const { id } = (await db.query<{ id: string }>(`select id from contributions where user_id = $1`, [USER])).rows[0];
    await db.query(`select delete_contribution($1)`, [id]);
    const h = await holding();
    expect(h.cost_cad).toBeNull();
    expect(Number(h.units)).toBe(5);
  });
  it('edits in one step, keeping the instalment link', async () => {
    await resolve('2026-11-15', 'manual', [line()], '2026-12-15');
    const { id } = (await db.query<{ id: string }>(`select id from contributions where user_id = $1`, [USER])).rows[0];
    await db.query(`select update_contribution($1, $2::jsonb)`, [id, JSON.stringify(line({ amount_cad: 1500, units: 15, amount_native: 1500 }))]);
    expect(Number((await room()).tfsa_room)).toBe(3500);
    expect(Number((await holding()).units)).toBe(15);
    const row = (await db.query<{ source: string; due: string }>(`select source, to_char(cycle_due_on, 'YYYY-MM-DD') as due from contributions where user_id = $1`, [USER])).rows[0];
    expect(row).toEqual({ source: 'manual', due: '2026-11-15' });
  });
  it("can't touch another user's contribution", async () => {
    await db.query(`select record_purchase($1::jsonb)`, [JSON.stringify(line())]);
    const { id } = (await db.query<{ id: string }>(`select id from contributions where user_id = $1`, [USER])).rows[0];
    await actAs(OTHER);
    await expect(db.query(`select delete_contribution($1)`, [id])).rejects.toThrow(/not found/);
  });
});

describe('contribution room', () => {
  it('restores a due withdrawal only once', async () => {
    await db.query(`insert into withdrawals (user_id, account, amount_cad, withdrawn_on, room_restored_in) values ($1, 'TFSA', 400, '2025-05-01', 2025)`, [USER]);
    await db.query(`select apply_room_restorations()`);
    await db.query(`select apply_room_restorations()`);
    expect(Number((await room()).tfsa_room)).toBe(5400);
    expect(await count('room_events')).toBe(1);
  });
  it('logs only the difference when correcting room', async () => {
    await db.query(`select set_room(5000, 3200)`);
    expect(Number((await room()).rrsp_room)).toBe(3200);
    const events = (await db.query<{ account: string; amount_cad: string }>(`select account, amount_cad from room_events where user_id = $1`, [USER])).rows;
    expect(events.map((e) => [e.account, Number(e.amount_cad)])).toEqual([['RRSP', 200]]);
  });
});

describe('daily job functions', () => {
  it('act for the given user without a signed-in session', async () => {
    await actAs(null);
    const result = await db.query<{ r: { applied: boolean } }>(`select resolve_cycle_as($1::uuid, '2026-11-15'::date, 'auto', $2::jsonb, '2026-12-15'::date) as r`, [USER, JSON.stringify([line()])]);
    expect(result.rows[0].r.applied).toBe(true);
    expect(Number((await room()).tfsa_room)).toBe(4000);
  });
  it('are closed to signed-in users', async () => {
    await db.exec(`set role authenticated`);
    try {
      await expect(db.query(`select resolve_cycle_as($1::uuid, '2026-11-15'::date, 'auto', '[]'::jsonb, '2026-12-15'::date)`, [OTHER])).rejects.toThrow(/permission denied/);
    } finally {
      await db.exec(`reset role`);
    }
  });
});

describe('row level security', () => {
  it("hides another user's rows", async () => {
    await db.query(`select record_purchase($1::jsonb)`, [JSON.stringify(line())]);
    await actAs(OTHER);
    await db.exec(`set role authenticated`);
    try {
      expect((await db.query(`select * from contributions`)).rows).toHaveLength(0);
      expect((await db.query(`select * from holdings`)).rows).toHaveLength(0);
    } finally {
      await db.exec(`reset role`);
    }
  });
  it('blocks public clients from the price caches', async () => {
    await db.exec(`insert into quote_cache values ('ZZZ', 1, 'CAD', now())`);
    await db.exec(`set role anon`);
    try {
      expect((await db.query(`select * from quote_cache`)).rows).toHaveLength(0);
      await expect(db.exec(`insert into quote_cache values ('FAKE', 1, 'CAD', now())`)).rejects.toThrow(/row-level security/);
    } finally {
      await db.exec(`reset role`);
    }
  });
});
