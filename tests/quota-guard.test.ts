import { describe, it, expect } from 'vitest';
import {
  mayUpload, mayWriteNonEssential, mayReadNonEssential, parseSimulation, readUsage, LIMITS,
} from '../scripts/lib/quota-guard.mjs';
import { estimateCycleUsage } from '../scripts/lib/capacity-estimate.mjs';

// FP6.4 (P4 Step 2h): simulated readings at every boundary.
const u = (storageMb: number, dbMb: number, egressProjectedGb: number) => ({ storageMb, dbMb, egressProjectedGb });
const ok = u(427, 181, 1.0);

describe('storage (uploads): alert 700, refuse 800', () => {
  it.each([
    [699, true, 'ok'], [700, true, 'warning'], [799, true, 'warning'], [800, false, 'critical'],
  ])('%s MB -> allowed=%s level=%s', (mb, allowed, level) => {
    const d = mayUpload({ ...ok, storageMb: mb });
    expect([d.allowed, d.level]).toEqual([allowed, level]);
  });
});

describe('DB size (non-essential writes): alert 350, pause 400', () => {
  it.each([
    [349, true, 'ok'], [350, true, 'warning'], [399, true, 'warning'], [400, false, 'critical'],
  ])('%s MB -> allowed=%s level=%s', (mb, allowed, level) => {
    const d = mayWriteNonEssential({ ...ok, dbMb: mb });
    expect([d.allowed, d.level]).toEqual([allowed, level]);
  });
});

describe('egress projected (non-essential reads): alert 3.5, pause 4.0', () => {
  it.each([
    [3.49, true, 'ok'], [3.5, true, 'warning'], [3.99, true, 'warning'], [4.0, false, 'critical'],
  ])('%s GB -> allowed=%s level=%s', (gb, allowed, level) => {
    const d = mayReadNonEssential({ ...ok, egressProjectedGb: gb });
    expect([d.allowed, d.level]).toEqual([allowed, level]);
  });
  it("today's real projection (~3.85 GB) is a WARNING, not a pause", () => {
    expect(mayReadNonEssential({ ...ok, egressProjectedGb: 3.85 })).toMatchObject({ allowed: true, level: 'warning' });
  });
});

describe('fail closed when usage is unreadable', () => {
  it('every question refuses with usage-unreadable', () => {
    const none = { storageMb: null, dbMb: null, egressProjectedGb: null };
    for (const f of [mayUpload, mayWriteNonEssential, mayReadNonEssential]) {
      expect(f(none as any)).toMatchObject({ allowed: false, reason: 'usage-unreadable' });
    }
  });
  it('readUsage with a failing client reports ok=false', async () => {
    const sb = { rpc: async () => ({ data: null, error: { message: 'boom' } }) } as any;
    const r = await readUsage(sb, { simulate: null });
    expect(r.ok).toBe(false);
    expect(mayUpload(r).allowed).toBe(false);
  });
});

describe('BOI_QUOTA_SIMULATE override', () => {
  it('parses known keys and ignores junk', () => {
    expect(parseSimulation('storage_mb=800, db_mb=181,foo=1')).toEqual({ storage_mb: 800, db_mb: 181 });
    expect(parseSimulation('')).toBeNull();
  });
  it('replaces the live reading and is flagged simulated', async () => {
    const sb = { rpc: async (fn: string) => fn === 'db_usage_report'
      ? { data: { storage_mb: 427.1, db_size_mb: 181 }, error: null }
      : { data: [], error: null } } as any;
    const r = await readUsage(sb, { simulate: { storage_mb: 800, egress_projected_gb: 3.85 } });
    expect(r).toMatchObject({ simulated: true, storageMb: 800, dbMb: 181, egressProjectedGb: 3.85 });
    expect(mayUpload(r).allowed).toBe(false);
  });
});

// Shared vector with config/test_quota_guard.py: both languages must project the same egress.
export const VECTOR = {
  now: '2026-09-27T12:00:00Z',
  snapshots: [
    { taken_at: '2026-09-11T00:00:00Z', api_calls: 7722258 },
    { taken_at: '2026-09-26T14:54:45Z', api_calls: 9388130 },
    { taken_at: '2026-09-27T08:24:07Z', api_calls: 9427196 },
  ],
};
describe('egress projection shared vector', () => {
  it('matches the value pinned in config/test_quota_guard.py', () => {
    const est = estimateCycleUsage(VECTOR.snapshots, new Date(VECTOR.now));
    expect(est.ok).toBe(true);
    expect(est.projectedEgressGB).toBeCloseTo(3.8513, 3);
    expect(LIMITS.egress.blockGb).toBe(4.0);
  });
});

// D2 / D13 (22 Oct): counter stop lines, warn 60% / shed 80% / minimum 95%.
import { mayUseCounter, counterAlert, weeklyEgressEmail, COUNTER_CAPS } from '../scripts/lib/quota-guard.mjs';

describe('R2 Class A monthly: stop at 900,000', () => {
  it.each([
    [539999, 'ok'], [540000, 'warning'], [719999, 'warning'], [720000, 'shed'],
    [854999, 'shed'], [855000, 'minimum'], [899999, 'minimum'], [900000, 'stop'],
  ])('%s ops -> level=%s', (n, level) => {
    expect(mayUseCounter('r2ClassAMonth', n).level).toBe(level);
  });
  it('stop refuses even essential work', () => {
    expect(mayUseCounter('r2ClassAMonth', 900000, { essential: true }).allowed).toBe(false);
  });
});

describe('Brevo sends per day: stop at 270', () => {
  it.each([[161, 'ok'], [162, 'warning'], [216, 'shed'], [257, 'minimum'], [270, 'stop']])('%s sends -> level=%s', (n, level) => {
    expect(mayUseCounter('brevoDay', n).level).toBe(level);
  });
  it('shed refuses non-essential sends and allows essential ones', () => {
    expect(mayUseCounter('brevoDay', 216).allowed).toBe(false);
    expect(mayUseCounter('brevoDay', 216, { essential: true }).allowed).toBe(true);
  });
  it('minimum allows only essential sends', () => {
    expect(mayUseCounter('brevoDay', 257, { essential: true }).allowed).toBe(true);
    expect(mayUseCounter('brevoDay', 257).allowed).toBe(false);
  });
});

describe('Resend sends per day: cap at 90', () => {
  it.each([[53, 'ok'], [54, 'warning'], [72, 'shed'], [86, 'minimum'], [90, 'stop']])('%s sends -> level=%s', (n, level) => {
    expect(mayUseCounter('resendDay', n).level).toBe(level);
  });
});

describe('unreadable counter fails closed', () => {
  it('refuses when the count is missing, essential or not', () => {
    expect(mayUseCounter('brevoDay', undefined).allowed).toBe(false);
    expect(mayUseCounter('brevoDay', NaN, { essential: true }).allowed).toBe(false);
  });
});

describe('alert and weekly egress email', () => {
  it('stop-line alert names the counter and the level', () => {
    const d = mayUseCounter('brevoDay', 270);
    const a = counterAlert('brevoDay', d);
    expect(a.subject).toBe('BOI stop line: Brevo sends (stop)');
    expect(COUNTER_CAPS.brevoDay.cap).toBe(270);
  });
  it('weekly egress email carries the projection and the level', () => {
    const e = weeklyEgressEmail({ storageMb: 427, dbMb: 181, egressProjectedGb: 3.85 }, new Date('2026-10-25T00:00:00Z'));
    expect(e.subject).toBe('BOI weekly egress: 3.85 GB projected of 5 GB (warning)');
    expect(e.body).toContain('Week ending 2026-10-25');
  });
});
