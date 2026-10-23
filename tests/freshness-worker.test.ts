// Freshness watchdog in the scheduler Worker (workers/boi-scheduler/src/freshness.ts): rules, reads, heartbeat,
// alert gating, the failure drill, and that the watchlist matches the workflow it replaces.
import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  evaluateFreshness, alertBody, latestRun, runFreshnessWatchdog, WATCHLIST, FRESHNESS_KEY, FRESHNESS_CRON,
  type FreshnessEnv,
} from '../workers/boi-scheduler/src/freshness';

const root = join(__dirname, '..');
const NOW = Date.parse('2026-10-24T03:10:00Z');
const RECENT = '2026-10-24T03:00:00Z';   // 10 minutes ago
const OLD = '2026-10-20T03:00:00Z';      // ~4 days ago

function kv() {
  const m = new Map<string, string>();
  return { m, store: { put: async (k: string, v: string) => { m.set(k, v); } } };
}
const env = (over: Partial<FreshnessEnv> = {}): { s: ReturnType<typeof kv>; e: FreshnessEnv } => {
  const s = kv();
  return { s, e: { BOI_SNAPSHOTS: s.store, TARGET: 'staging', GITHUB_REPO: 'o/r', GITHUB_READ_TOKEN: 'tok-TEST', RESEND_API_KEY: 'key-TEST', BRIEF_EMAIL: 'to@example.com', ALERTS_ENABLED: 'false', ...over } };
};
const allRecent = () => Object.fromEntries(Object.keys(WATCHLIST).map((f) => [f, RECENT]));

describe('evaluateFreshness', () => {
  it('a recent run is fresh; no alert', () => {
    const r = evaluateFreshness(allRecent(), NOW);
    expect(r.stale).toHaveLength(0);
    expect(r.errors).toHaveLength(0);
  });
  it('a run older than its interval times its multiple is stale, with the reason', () => {
    const latest = { ...allRecent(), 'health-check.yml': OLD };
    const r = evaluateFreshness(latest, NOW);
    expect(r.stale.map((s) => s.file)).toEqual(['health-check.yml']);
    expect(r.stale[0].reason).toMatch(/expected within about 48 h/);
  });
  it('no runs at all is stale', () => {
    const r = evaluateFreshness({ ...allRecent(), 'radar.yml': null }, NOW);
    expect(r.stale[0]).toMatchObject({ file: 'radar.yml', kind: 'no-runs' });
  });
  it('a read error is a check error, never stale and never fresh', () => {
    const r = evaluateFreshness({ ...allRecent(), 'radar.yml': { error: 'HTTP 503' } }, NOW);
    expect(r.errors).toEqual([{ file: 'radar.yml', kind: 'error', reason: 'HTTP 503' }]);
    expect(r.stale).toHaveLength(0);
  });
  it('a run time that does not parse is a check error', () => {
    const r = evaluateFreshness({ ...allRecent(), 'radar.yml': 'not a time' }, NOW);
    expect(r.errors[0].reason).toMatch(/could not be read/);
  });
  it('scrape prices allows 26 hours with a multiple of 1', () => {
    const inside = evaluateFreshness({ ...allRecent(), 'scrape-prices.yml': '2026-10-23T02:00:00Z' }, NOW);
    expect(inside.stale).toHaveLength(0);
    const outside = evaluateFreshness({ ...allRecent(), 'scrape-prices.yml': '2026-10-22T20:00:00Z' }, NOW);
    expect(outside.stale.map((s) => s.file)).toEqual(['scrape-prices.yml']);
  });
});

describe('latestRun (read path)', () => {
  it('returns the newest completed run time', async () => {
    const f = vi.fn(async (..._args: unknown[]) => new Response(JSON.stringify({ workflow_runs: [{ created_at: RECENT }] }), { status: 200 }));
    const { e } = env();
    expect(await latestRun('radar.yml', e, f as any)).toBe(RECENT);
    expect(String(f.mock.calls[0][0])).toContain('/repos/o/r/actions/workflows/radar.yml/runs?per_page=1&status=completed');
  });
  it('a workflow with no runs returns null', async () => {
    const f = vi.fn(async (..._args: unknown[]) => new Response(JSON.stringify({ workflow_runs: [] }), { status: 200 }));
    expect(await latestRun('radar.yml', env().e, f as any)).toBeNull();
  });
  it('an HTTP error throws, so the caller records a check error', async () => {
    const f = vi.fn(async (..._args: unknown[]) => new Response('', { status: 503 }));
    await expect(latestRun('radar.yml', env().e, f as any)).rejects.toThrow('HTTP 503');
  });
  it('the read token is sent in the header, never in the URL', async () => {
    const f = vi.fn(async (..._args: unknown[]) => new Response(JSON.stringify({ workflow_runs: [] }), { status: 200 }));
    await latestRun('radar.yml', env().e, f as any);
    expect(String(f.mock.calls[0][0])).not.toContain('tok-TEST');
    expect((f.mock.calls[0][1] as any).headers.authorization).toBe('Bearer tok-TEST');
  });
});

describe('runFreshnessWatchdog', () => {
  it('healthy: writes a heartbeat and sends no mail', async () => {
    const { s, e } = env({ ALERTS_ENABLED: 'true' });
    const f = vi.fn(async () => new Response(JSON.stringify({ workflow_runs: [{ created_at: RECENT }] }), { status: 200 }));
    const sent: string[] = [];
    const r = await runFreshnessWatchdog(e, f as any, NOW, async (s2) => { sent.push(s2); });
    expect(r.ok).toBe(true);
    expect(sent).toHaveLength(0);
    const hb = JSON.parse(s.m.get(FRESHNESS_KEY)!);
    expect(hb).toMatchObject({ target: 'staging', checked: Object.keys(WATCHLIST).length, stale: 0, errors: 0, ok: true });
  });

  it('failure drill: every read fails. The run completes, records the errors, and alerts when enabled', async () => {
    const { s, e } = env({ ALERTS_ENABLED: 'true' });
    const f = vi.fn(async () => { throw new Error('network down'); });
    const sent: { subject: string; text: string }[] = [];
    const r = await runFreshnessWatchdog(e, f as any, NOW, async (subject, text) => { sent.push({ subject, text }); });
    expect(r.errors).toHaveLength(Object.keys(WATCHLIST).length);
    expect(r.ok).toBe(false);
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain('could not be checked');
    const hb = JSON.parse(s.m.get(FRESHNESS_KEY)!);
    expect(hb.ok).toBe(false);
    expect(hb.errors).toBe(Object.keys(WATCHLIST).length);
  });

  it('failure drill with no read token: fails closed, names the missing configuration, sends nothing when alerts are off', async () => {
    const { e } = env({ GITHUB_READ_TOKEN: undefined, ALERTS_ENABLED: 'false' });
    const sent: string[] = [];
    const r = await runFreshnessWatchdog(e, vi.fn() as any, NOW, async (s) => { sent.push(s); });
    expect(r.errors[0].reason).toMatch(/not configured/);
    expect(sent).toHaveLength(0);
  });

  it('a stale workflow sends one mail that names it, and does not contain the read token', async () => {
    const { e } = env({ ALERTS_ENABLED: 'true' });
    const f = vi.fn(async (url: string) => new Response(JSON.stringify({ workflow_runs: [{ created_at: url.includes('health-check') ? OLD : RECENT }] }), { status: 200 }));
    const sent: { subject: string; text: string }[] = [];
    await runFreshnessWatchdog(e, f as any, NOW, async (subject, text) => { sent.push({ subject, text }); });
    expect(sent).toHaveLength(1);
    expect(sent[0].text).toContain('health-check.yml');
    expect(sent[0].text).not.toContain('tok-TEST');
  });

  it('the heartbeat never contains the token', async () => {
    const { s, e } = env();
    await runFreshnessWatchdog(e, (async () => new Response('', { status: 500 })) as any, NOW);
    expect(s.m.get(FRESHNESS_KEY)).not.toContain('tok-TEST');
  });
});

describe('alertBody', () => {
  it('lists stale files and check errors by name and reason', () => {
    const { subject, text } = alertBody({ checked: 2, stale: [{ file: 'a.yml', kind: 'stale', reason: 'old' }], errors: [{ file: 'b.yml', kind: 'error', reason: 'HTTP 500' }], ok: false }, 'o/r');
    expect(subject).toBe('BOI Watchdog: 1 scheduled workflow(s) gone stale');
    expect(text).toContain('- a.yml: old');
    expect(text).toContain('- b.yml: HTTP 500');
  });
});

describe('wiring', () => {
  it('the staging cron matches the freshness cron', () => {
    const wrangler = readFileSync(join(root, 'workers/boi-scheduler/wrangler.jsonc'), 'utf8');
    expect(wrangler).toContain(`"${FRESHNESS_CRON}"`);
  });
  it('the watchlist matches the workflow it replaces (same files, same intervals)', () => {
    const wf = readFileSync(join(root, '.github/workflows/workflow-freshness-watchdog.yml'), 'utf8');
    const listed = [...wf.matchAll(/"([a-z0-9-]+\.yml)":\s+\[([^\]]+)\]/g)].map((m) => m[1]).sort();
    expect(Object.keys(WATCHLIST).sort()).toEqual(listed);
  });
  it('the scheduled handler routes the freshness cron to the watchdog', () => {
    const src = readFileSync(join(root, 'workers/boi-scheduler/src/index.ts'), 'utf8');
    expect(src).toMatch(/if \(ev\.cron === FRESHNESS_CRON\)/);
  });
});
