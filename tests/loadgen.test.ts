// Staging load generator (workers/boi-scheduler/src/loadgen.ts): window, seeded choice, planning, and the send rules.
import { describe, it, expect, vi } from 'vitest';
import { seededRandom, inWindow, pickTemplate, planMinute, runMinute, loadgenSettings, LOADGEN_KEY, PER_MINUTE, type Profile, type Samples } from '../workers/boi-scheduler/src/loadgen';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const PROFILE: Profile = { classes: [
  { template: '/sets/[slug]', share: 0.6 },
  { template: '/reviews/[slug]', share: 0.3 },
  { template: '/compare', share: 0.1 },
] };
const SAMPLES: Samples = {
  '/sets/[slug]': ['/sets/1-a', '/sets/2-b'],
  '/reviews/[slug]': ['/reviews/x-1'],
  '/compare': ['/compare'],
};
const START = '2026-10-24T00:00:00.000Z';
const END = '2026-10-25T01:00:00.000Z';
const at = (iso: string) => Date.parse(iso);

function store() {
  const m = new Map<string, string>();
  return { m, kv: { get: async (k: string) => m.get(k) ?? null, put: async (k: string, v: string) => { m.set(k, v); } } };
}
const env = (over: Partial<{ TARGET: string; STAGING_SITE_URL: string; LOADGEN_START: string; LOADGEN_END: string; LOADGEN_ENABLED: boolean }> = {}) => {
  const s = store();
  return { s, e: { BOI_SNAPSHOTS: s.kv, TARGET: 'staging', STAGING_SITE_URL: 'https://staging.example', LOADGEN_START: START, LOADGEN_END: END, LOADGEN_ENABLED: true, ...over } };
};

describe('window', () => {
  it('is open from start up to, not including, end', () => {
    expect(inWindow(at(START), START, END)).toBe(true);
    expect(inWindow(at(END), START, END)).toBe(false);
    expect(inWindow(at(START) - 1, START, END)).toBe(false);
  });
  it('is closed when either time is missing or unparsable, or end is not after start', () => {
    expect(inWindow(at(START), '', END)).toBe(false);
    expect(inWindow(at(START), 'not a time', END)).toBe(false);
    expect(inWindow(at(START), END, START)).toBe(false);
  });
});

describe('seeded choice', () => {
  it('the same seed gives the same sequence; a different seed does not', () => {
    const a = seededRandom(7), b = seededRandom(7), c = seededRandom(8);
    const sa = [a(), a(), a()], sb = [b(), b(), b()], sc = [c(), c(), c()];
    expect(sa).toEqual(sb);
    expect(sa).not.toEqual(sc);
    for (const x of sa) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });
  it('picks by share: over many draws the 60% class is the most common', () => {
    const r = seededRandom(1);
    const count: Record<string, number> = {};
    for (let i = 0; i < 20000; i++) { const t = pickTemplate(PROFILE, SAMPLES, r)!; count[t] = (count[t] ?? 0) + 1; }
    expect(count['/sets/[slug]']).toBeGreaterThan(count['/reviews/[slug]']);
    expect(count['/reviews/[slug]']).toBeGreaterThan(count['/compare']);
    expect(Math.abs(count['/sets/[slug]'] / 20000 - 0.6)).toBeLessThan(0.02);
  });
  it('a class with no sample paths is skipped, and the rest are renormalised', () => {
    const r = seededRandom(2);
    const t = new Set<string>();
    for (let i = 0; i < 500; i++) t.add(pickTemplate(PROFILE, { '/compare': ['/compare'] }, r)!);
    expect([...t]).toEqual(['/compare']);
  });
  it('an empty profile picks nothing', () => {
    expect(pickTemplate({ classes: [] }, SAMPLES, seededRandom(3))).toBeNull();
  });
});

describe('planMinute', () => {
  it('plans PER_MINUTE requests, deterministically for a seed', () => {
    const p1 = planMinute(PROFILE, SAMPLES, 42);
    const p2 = planMinute(PROFILE, SAMPLES, 42);
    expect(p1.paths).toHaveLength(PER_MINUTE);
    expect(p1).toEqual(p2);
    expect(p1.skipped).toBe(0);
  });
  it('an empty profile plans nothing and counts every request as skipped', () => {
    const p = planMinute({ classes: [] }, SAMPLES, 42);
    expect(p.paths).toHaveLength(0);
    expect(p.skipped).toBe(PER_MINUTE);
  });
});

describe('runMinute: send rules', () => {
  it('refuses to send on any target but staging, and sends nothing', async () => {
    const { s, e } = env({ TARGET: 'production' });
    let calls = 0;
    const r = await runMinute(e as any, PROFILE, SAMPLES, at('2026-10-24T10:00:00Z'), (async () => { calls++; return new Response(''); }) as any, 0);
    expect(r.state).toBe('refused');
    expect(calls).toBe(0);
    expect(JSON.parse(s.m.get(LOADGEN_KEY)!).state).toBe('refused');
  });
  it('refuses to send with no staging site address', async () => {
    const { e } = env({ STAGING_SITE_URL: '' });
    const r = await runMinute(e as any, PROFILE, SAMPLES, at('2026-10-24T10:00:00Z'), (async () => new Response('')) as any, 0);
    expect(r.state).toBe('refused');
  });
  it('is closed outside the window, and sends nothing', async () => {
    const { e } = env();
    let calls = 0;
    const r = await runMinute(e as any, PROFILE, SAMPLES, at(END), (async () => { calls++; return new Response(''); }) as any, 0);
    expect(r.state).toBe('closed');
    expect(calls).toBe(0);
  });
  it('inside the window, sends the plan to the staging address and counts ok and errors', async () => {
    const { s, e } = env();
    const urls: string[] = [];
    let n = 0;
    const fake = (async (url: string) => {
      urls.push(url);
      n++;
      return new Response('', { status: n % 10 === 0 ? 500 : 200 });
    }) as any;
    const r = await runMinute(e as any, PROFILE, SAMPLES, at('2026-10-24T10:00:00Z'), fake, 0);
    expect(r.state).toBe('sent');
    expect(r.sent).toBe(PER_MINUTE);
    expect(r.ok + r.errors).toBe(PER_MINUTE);
    expect(r.errors).toBe(6);
    expect(urls.every((u) => u.startsWith('https://staging.example/'))).toBe(true);
    expect(JSON.parse(s.m.get(LOADGEN_KEY)!).sent).toBe(PER_MINUTE);
  });
  it('a failed request is counted as an error and its text is not recorded', async () => {
    const { s, e } = env();
    const fake = (async () => { throw new Error('secret-ish detail https://staging.example/x?token=abc'); }) as any;
    const r = await runMinute(e as any, PROFILE, SAMPLES, at('2026-10-24T10:00:00Z'), fake, 0);
    expect(r.errors).toBe(PER_MINUTE);
    expect(s.m.get(LOADGEN_KEY)).not.toContain('token=abc');
  });
  it('the shipped placeholder profile sends nothing: every request is skipped', async () => {
    const { e } = env();
    let calls = 0;
    const r = await runMinute(e as any, { classes: [] }, {}, at('2026-10-24T10:00:00Z'), (async () => { calls++; return new Response(''); }) as any, 0);
    expect(r.sent).toBe(0);
    expect(r.skipped).toBe(PER_MINUTE);
    expect(calls).toBe(0);
  });
});

describe('load generator flag (default off)', () => {
  it('flag off: sends no request and records an off minute', async () => {
    const store = new Map<string, string>();
    const env = {
      BOI_SNAPSHOTS: { get: async (k: string) => store.get(k) ?? null, put: async (k: string, v: string) => { store.set(k, v); } },
      TARGET: 'staging',
      STAGING_SITE_URL: 'https://staging.example',
      LOADGEN_START: '2000-01-01T00:00:00Z',
      LOADGEN_END: '2100-01-01T00:00:00Z',
      LOADGEN_ENABLED: false,
    };
    const fetchSpy = vi.fn(async () => new Response('', { status: 200 }));
    const profile = { classes: [{ template: '/', share: 1 }] };
    const samples = { '/': ['/'] };
    const r = await runMinute(env as any, profile, samples, Date.parse('2026-10-23T12:00:00Z'), fetchSpy as any, 0);
    expect(r.state).toBe('off');
    expect(r.sent).toBe(0);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(JSON.parse(store.get(LOADGEN_KEY)!).state).toBe('off');
  });
});


describe('load generator settings come from the flag store', () => {
  const root = join(__dirname, '..');
  it('closed by default: nothing enabled, no address, no window', () => {
    expect(loadgenSettings({})).toEqual({ LOADGEN_ENABLED: false, STAGING_SITE_URL: undefined, LOADGEN_START: undefined, LOADGEN_END: undefined });
  });
  it('enabled only when the flag is exactly true', () => {
    expect(loadgenSettings({ loadgen_enabled: 'true' }).LOADGEN_ENABLED).toBe(false);
    expect(loadgenSettings({ loadgen_enabled: 1 }).LOADGEN_ENABLED).toBe(false);
    expect(loadgenSettings({ loadgen_enabled: true }).LOADGEN_ENABLED).toBe(true);
  });
  it('reads the address and window from the flag store, and drops non-string values', () => {
    const s = loadgenSettings({ loadgen_enabled: true, loadgen_site_url: 'https://staging.example', loadgen_start: '2026-10-25T00:00:00Z', loadgen_end: '2026-10-26T01:00:00Z' });
    expect(s).toEqual({ LOADGEN_ENABLED: true, STAGING_SITE_URL: 'https://staging.example', LOADGEN_START: '2026-10-25T00:00:00Z', LOADGEN_END: '2026-10-26T01:00:00Z' });
    expect(loadgenSettings({ loadgen_site_url: 42, loadgen_start: null, loadgen_end: '' })).toMatchObject({ STAGING_SITE_URL: undefined, LOADGEN_START: undefined, LOADGEN_END: undefined });
  });
  it('the Worker profile is the measured profile file (same content, with classes)', () => {
    const measured = JSON.parse(readFileSync(join(root, 'docs/release/gates/load-profile.json'), 'utf8'));
    const worker = JSON.parse(readFileSync(join(root, 'workers/boi-scheduler/src/load-profile.json'), 'utf8'));
    expect(worker).toEqual(measured);
    expect(worker.classes.length).toBeGreaterThan(0);
  });
  it('the Wrangler file commits no address or window', () => {
    const wrangler = readFileSync(join(root, 'workers/boi-scheduler/wrangler.jsonc'), 'utf8');
    expect(wrangler).not.toMatch(/STAGING_SITE_URL|LOADGEN_START|LOADGEN_END/);
  });
});


// Segment match, as in the profile builder: a bracketed segment matches one segment, anything else must be equal.
function matchesTemplate(template: string, path: string): boolean {
  if (template === '/') return path === '/';
  const t = template.replace(/\/$/, '').split('/');
  const p = path.replace(/\/$/, '').split('/');
  if (t.length !== p.length) return false;
  return t.every((seg, i) => (seg.startsWith('[') ? p[i].length > 0 : seg === p[i]));
}

describe('every profile class has sample paths', () => {
  const root = join(__dirname, '..');
  const profile = JSON.parse(readFileSync(join(root, 'docs/release/gates/load-profile.json'), 'utf8'));
  const samples: Record<string, string[]> = JSON.parse(readFileSync(join(root, 'workers/boi-scheduler/src/load-samples.json'), 'utf8'));
  it('no profile class is missing its samples', () => {
    const missing = profile.classes.map((c: { template: string }) => c.template).filter((t: string) => !(samples[t]?.length > 0));
    expect(missing).toEqual([]);
  });
  it('each sample path matches its class template (the not-found class uses made-up addresses)', () => {
    for (const c of profile.classes as { template: string }[]) {
      if (c.template === '(not found)') continue;
      for (const p of samples[c.template]) expect(matchesTemplate(c.template, p), `${p} does not match ${c.template}`).toBe(true);
    }
  });
});
