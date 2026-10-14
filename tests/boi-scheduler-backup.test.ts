import { describe, it, expect, vi, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BACKUP_CRON, BACKUP_JOBS, countRunsToday, decideBackup, dispatchWorkflow, istDay, istMidnightIso, jobForSlot,
} from '../workers/boi-scheduler/src/backup';
import { RESERVED_RE } from '../workers/boi-scheduler/src/auth';

afterEach(() => vi.unstubAllGlobals());

describe('IST day', () => {
  it('uses IST, not UTC: 20:00 UTC on the 13th is the 14th in IST', () => {
    expect(istDay(new Date('2026-10-13T20:00:00Z'))).toBe('2026-10-14');
  });
  it('still the 13th at 18:29 UTC', () => {
    expect(istDay(new Date('2026-10-13T18:29:00Z'))).toBe('2026-10-13');
  });
  it('IST midnight as an ISO string with offset', () => {
    expect(istMidnightIso('2026-10-14')).toBe('2026-10-14T00:00:00+05:30');
  });
});

describe('slot to job', () => {
  it('maps each Mon/Wed/Fri slot to its workflow', () => {
    const mon = (h: number) => new Date(Date.UTC(2026, 9, 12, h, 30)); // 12 Oct 2026 is a Monday
    expect(jobForSlot(mon(9))?.file).toBe('video-generate-daily.yml');
    expect(jobForSlot(mon(12))?.file).toBe('video-generate-quiet-panic.yml');
    expect(jobForSlot(mon(13))?.file).toBe('video-publish-poller-quiet-panic.yml');
    expect(jobForSlot(mon(15))?.file).toBe('video-publish-poller.yml');
    expect(jobForSlot(mon(17))?.file).toBe('social-automation.yml');
  });
  it('returns null off-slot, off-minute, or off-day', () => {
    expect(jobForSlot(new Date(Date.UTC(2026, 9, 12, 10, 30)))).toBeNull();
    expect(jobForSlot(new Date(Date.UTC(2026, 9, 12, 9, 0)))).toBeNull();
    expect(jobForSlot(new Date(Date.UTC(2026, 9, 13, 9, 30)))).toBeNull(); // Tuesday
  });
  it('every backup file exists in the repo workflows', () => {
    for (const j of Object.values(BACKUP_JOBS)) {
      expect(existsSync(resolve(__dirname, '..', '.github', 'workflows', j.file)), j.file).toBe(true);
    }
  });
  it('the Worker trigger in wrangler.jsonc matches BACKUP_CRON', () => {
    const wrangler = readFileSync(resolve(__dirname, '..', 'workers', 'boi-scheduler', 'wrangler.jsonc'), 'utf8');
    expect(wrangler).toContain(`"${BACKUP_CRON}"`);
  });
});

describe('decideBackup', () => {
  const on = { isProduction: true, flagOn: true, hasToken: true, alreadyClaimed: false, startedToday: 0 };
  it('dispatches when everything is on and nothing started today', () => {
    expect(decideBackup(on).action).toBe('dispatch');
  });
  it('is inert off production', () => {
    expect(decideBackup({ ...on, isProduction: false })).toEqual({ action: 'skip', reason: 'not production' });
  });
  it('is inert with the flag off', () => {
    expect(decideBackup({ ...on, flagOn: false }).reason).toBe('flag off');
  });
  it('skips without a token', () => {
    expect(decideBackup({ ...on, hasToken: false }).reason).toBe('no dispatch token');
  });
  it('skips when already claimed today', () => {
    expect(decideBackup({ ...on, alreadyClaimed: true, startedToday: null }).reason).toBe('already claimed today');
  });
  it('skips when GitHub already started it today', () => {
    expect(decideBackup({ ...on, startedToday: 2 }).reason).toBe('already started today (2 run(s))');
  });
  it('fails safe when the run list cannot be read', () => {
    expect(decideBackup({ ...on, startedToday: null }).reason).toBe('could not read runs (fail safe)');
    expect(decideBackup({ ...on, startedToday: null }).action).toBe('skip');
  });
});

describe('GitHub calls', () => {
  it('counts runs created since IST midnight', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ total_count: 3 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await countRunsToday('t', 'o/r', 'social-automation.yml', '2026-10-14')).toBe(3);
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain('/repos/o/r/actions/workflows/social-automation.yml/runs');
    expect(decodeURIComponent(url)).toContain('created=>=2026-10-14T00:00:00+05:30');
  });
  it('throws on a failed run list (so the caller skips)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('no', { status: 403 })));
    await expect(countRunsToday('t', 'o/r', 'x.yml', '2026-10-14')).rejects.toThrow('HTTP 403');
  });
  it('dispatches with ref main and no inputs', async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await dispatchWorkflow('t', 'o/r', 'x.yml')).toBe(204);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({ ref: 'main' });
  });
});

describe('client writes', () => {
  it('clients cannot write the backup claim keys', () => {
    expect(RESERVED_RE.test('meta:backup:social-automation.yml:2026-10-14')).toBe(true);
    expect(RESERVED_RE.test('meta:backup_fail')).toBe(true);
  });
});
