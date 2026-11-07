import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { VIDEO_DISPATCH, SCRAPE_STORE_BY_CRON, TIME_INDEX, dispatchWorkflow, resolveCron, planScheduled } from '../workers/boi-scheduler/src/dispatch';

// Order 0970: the scheduler Worker triggers the two video publish pollers at their slot times, and once more an hour later.

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

// wrangler.jsonc is JSONC: drop the whole-line // comments, then parse.
const wrangler = JSON.parse(read('workers/boi-scheduler/wrangler.jsonc').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n'));
const SCRAPE_CRONS = ['0 3 * * *', '5 3 * * *'];

// Cloudflare cron day-of-week (developers.cloudflare.com/workers/configuration/cron-triggers/): 1 = Sunday to
// 7 = Saturday, or the three-letter names. 0 is not a day. Returns the problems with a cron string; [] means it passes.
const CF_DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
function cronProblems(expr: string): string[] {
  const f = expr.trim().split(/\s+/);
  if (f.length !== 5) return ['expected five fields'];
  const problems: string[] = [];
  const check = (field: string, lo: number, hi: number, label: string) => {
    for (const item of field.split(',')) {
      for (const part of item.split('-')) {
        if (part === '*') continue;
        if (!/^\d+$/.test(part) || Number(part) < lo || Number(part) > hi) problems.push(`${label} ${part} is outside ${lo}-${hi}`);
      }
    }
  };
  check(f[0], 0, 59, 'minute');
  check(f[1], 0, 23, 'hour');
  check(f[2], 1, 31, 'day of month');
  check(f[3], 1, 12, 'month');
  for (const item of f[4].split(',')) {
    for (const part of item.split('-')) {
      if (part === '*' || CF_DAY_NAMES.includes(part.toUpperCase())) continue;
      if (part === '0') problems.push('day-of-week 0 is not a day: Sunday is 1 or SUN (Cloudflare numbers 1 = Sunday to 7 = Saturday)');
      else if (!/^[1-7]$/.test(part)) problems.push(`day-of-week ${part} is not a name or a number 1-7`);
    }
  }
  return problems;
}

// IST = UTC + 5h30. Minutes of the day in IST for a UTC cron (hour, minute).
const istMinute = (cron: string) => {
  const [m, h] = cron.split(' ').map(Number);
  return (h * 60 + m + 330) % 1440;
};
const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
// JavaScript getUTCDay numbering (0 = Sunday) for the day names in a cron string.
const JS_DAY: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
const utcDays = (cron: string) => cron.split(' ')[4].split(',').map((d) => JS_DAY[d]);

class FakeKv {
  store = new Map<string, string>();
  async get(key: string, type?: string) {
    const v = this.store.get(key);
    if (v === undefined) return null;
    return type === 'json' ? JSON.parse(v) : v;
  }
  async put(key: string, value: string) {
    this.store.set(key, value);
  }
}

const envFor = (over: Partial<{ token: string; enabled: boolean; target: string }> = {}) => {
  const kv = new FakeKv();
  if (over.enabled !== false) kv.store.set('flag:v1', JSON.stringify({ dispatch_enabled: over.enabled ?? true }));
  return {
    kv,
    env: {
      BOI_SNAPSHOTS: kv,
      BOI_SCHEDULER_DISPATCH_TOKEN: over.token ?? 'token-value-not-printed',
      TARGET: over.target ?? 'production',
      GITHUB_REPO: 'bricksofindia007/bricks-of-india',
    },
  };
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('production crons match the dispatch table (order 0970)', () => {
  it('the production triggers are the two scrape crons plus exactly the video dispatch crons', () => {
    const crons = [...wrangler.triggers.crons].sort();
    const expected = [...SCRAPE_CRONS, ...Object.keys(VIDEO_DISPATCH)].sort();
    expect(crons).toEqual(expected);
  });

  it('staging triggers are unchanged by this work (no video dispatch on staging)', () => {
    const stagingCrons: string[] = wrangler.env.staging.triggers.crons;
    for (const cron of Object.keys(VIDEO_DISPATCH)) expect(stagingCrons).not.toContain(cron);
  });

  it('every video dispatch target is a workflow file on main that accepts a manual dispatch', () => {
    for (const { file } of Object.values(VIDEO_DISPATCH)) {
      const path = `.github/workflows/${file}`;
      expect(existsSync(join(root, path)), path).toBe(true);
      const doc = parseYaml(read(path));
      const on = (doc as Record<string, unknown>).on;
      expect(on, path).toHaveProperty('workflow_dispatch');
    }
  });
});

describe('slot arithmetic matches the video slots (order 0970)', () => {
  const cadence = read('scripts/video/cadence.py');

  it('the slot constants this file relies on are the ones in cadence.py', () => {
    expect(cadence).toContain('slot_start_ist=(19, 30)');   // VID-P4
    expect(cadence).toContain('catchup_start_ist=(7, 0)');  // VID-P4 catch-up
    expect(cadence).toContain('slot_start_ist=(0, 0)');     // VID-QP
    expect(cadence).toContain('slot_weekdays=frozenset({2, 4, 6})'); // VID-P4 Wed, Fri, Sun
    expect(cadence).toContain('slot_weekdays=frozenset({1, 3, 5})'); // VID-QP Tue, Thu, Sat
  });

  it('VID-P4 dispatches 5 minutes after the 19:30 IST slot, and again 60 minutes later', () => {
    expect(hhmm(istMinute('5 14 * * SUN,WED,FRI'))).toBe('19:35');
    expect(hhmm(istMinute('5 15 * * SUN,WED,FRI'))).toBe('20:35');
  });

  it('VID-QP dispatches 5 minutes after the 00:00 IST slot, and again 60 minutes later', () => {
    expect(hhmm(istMinute('35 18 * * MON,WED,FRI'))).toBe('00:05');
    expect(hhmm(istMinute('35 19 * * MON,WED,FRI'))).toBe('01:05');
  });

  it('the VID-P4 UTC days are the IST slot days (Sun, Wed, Fri), the same calendar day', () => {
    expect(utcDays('5 14 * * SUN,WED,FRI')).toEqual([0, 3, 5]); // JS: 0 Sun, 3 Wed, 5 Fri
  });

  it('the VID-QP UTC days are the day before the IST slot days (Tue, Thu, Sat IST), because 00:05 IST is the previous UTC day', () => {
    const istDays = utcDays('35 18 * * MON,WED,FRI').map((d) => (d + 1) % 7); // JS: Tue 2, Thu 4, Sat 6
    expect(istDays).toEqual([2, 4, 6]);
  });

  it('each dispatch entry names a retry or a slot, and each slot has its retry', () => {
    const names = Object.values(VIDEO_DISPATCH).map((v) => v.name).sort();
    expect(names).toEqual(['vidp4-retry', 'vidp4-slot', 'vidqp-retry', 'vidqp-slot']);
  });
});

describe('dispatch gate and retry (order 0970)', () => {
  const okResponse = (status: number) => ({ status, ok: status >= 200 && status < 300 });

  it('is inert with no token, with the flag off, or outside production: no call, nothing written', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    for (const over of [{ token: '' }, { enabled: false }, { target: 'staging' }]) {
      const { kv, env } = envFor(over);
      const status = await dispatchWorkflow(env, 'video-publish-poller.yml', {}, 'vidp4-slot', 'slot', [0]);
      expect(status).toBe(0);
      expect(kv.store.has('meta:dispatch:vidp4-slot')).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the workflow dispatch on main with empty inputs, and records the outcome under its own name', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(204));
    vi.stubGlobal('fetch', fetchMock);
    const { kv, env } = envFor();
    const status = await dispatchWorkflow(env, 'video-publish-poller.yml', {}, 'vidp4-slot', '2026-11-08T14:05:00.000Z', [0]);
    expect(status).toBe(204);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.github.com/repos/bricksofindia007/bricks-of-india/actions/workflows/video-publish-poller.yml/dispatches');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ ref: 'main', inputs: {} });
    const note = JSON.parse(kv.store.get('meta:dispatch:vidp4-slot') as string);
    expect(note).toMatchObject({ slot: '2026-11-08T14:05:00.000Z', store: null, workflow: 'video-publish-poller.yml', http_status: 204 });
    expect(kv.store.has('meta:dispatch_fail')).toBe(false);
  });

  it('retries once when the first attempt fails, and stops when it succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(okResponse(500)).mockResolvedValueOnce(okResponse(204));
    vi.stubGlobal('fetch', fetchMock);
    const { kv, env } = envFor();
    const status = await dispatchWorkflow(env, 'video-publish-poller-quiet-panic.yml', {}, 'vidqp-slot', 'slot', [0, 0, 0]);
    expect(status).toBe(204);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(kv.store.has('meta:dispatch_fail')).toBe(false);
  });

  it('a dispatch that fails every attempt is recorded as a failure, and nothing is posted by the Worker itself', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(422));
    vi.stubGlobal('fetch', fetchMock);
    const { kv, env } = envFor();
    const status = await dispatchWorkflow(env, 'video-publish-poller.yml', {}, 'vidp4-retry', 'slot', [0, 0, 0]);
    expect(status).toBe(422);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(kv.store.has('meta:dispatch_fail')).toBe(true);
    expect(JSON.parse(kv.store.get('meta:dispatch:vidp4-retry') as string).http_status).toBe(422);
  });

  it('the scrape dispatch keeps its own note name and store field', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(204));
    vi.stubGlobal('fetch', fetchMock);
    const { kv, env } = envFor();
    await dispatchWorkflow(env, 'scrape-prices.yml', { store: 'mybrickhouse' }, 'mybrickhouse', 'slot', [0]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ ref: 'main', inputs: { store: 'mybrickhouse' } });
    expect(JSON.parse(kv.store.get('meta:dispatch:mybrickhouse') as string)).toMatchObject({ store: 'mybrickhouse', http_status: 204 });
  });
});

describe('cron strings use Cloudflare day syntax (order 0990)', () => {
  const productionCrons: string[] = wrangler.triggers.crons;
  const videoCrons = productionCrons.filter((c) => !SCRAPE_CRONS.includes(c));

  it('the validator rejects day 0 and out-of-range or unknown day names, and accepts the day-name form', () => {
    expect(cronProblems('5 14 * * 0,3,5')).toEqual([expect.stringMatching(/day-of-week 0 is not a day/)]);
    expect(cronProblems('5 14 * * 8')).toEqual([expect.stringMatching(/day-of-week 8/)]);
    expect(cronProblems('5 14 * * FUN')).toEqual([expect.stringMatching(/day-of-week FUN/)]);
    expect(cronProblems('5 14 * * SUN,WED,FRI')).toEqual([]);
    expect(cronProblems('35 18 * * MON,WED,FRI')).toEqual([]);
    expect(cronProblems('5 14 * * 1,4')).toEqual([]); // numbers 1-7 are valid Cloudflare days
  });

  it('every production cron passes the validator', () => {
    for (const cron of productionCrons) expect(cronProblems(cron), cron).toEqual([]);
  });

  it('each video cron has a matching dispatch key, and the keys are exactly the video crons', () => {
    for (const cron of videoCrons) expect(Object.keys(VIDEO_DISPATCH), cron).toContain(cron);
    expect(Object.keys(VIDEO_DISPATCH).sort()).toEqual([...videoCrons].sort());
  });

  it('the four video crons are written with the day names the order lists', () => {
    expect([...videoCrons].sort()).toEqual([
      '35 18 * * MON,WED,FRI',
      '35 19 * * MON,WED,FRI',
      '5 14 * * SUN,WED,FRI',
      '5 15 * * SUN,WED,FRI',
    ]);
  });
});

// Order 1000: if the cron text is not a table key, the scheduled time decides. Both paths and the unknown time are tested.
// 8 Nov 2026 is a Sunday, 9 Nov a Monday, 10 Nov a Tuesday (UTC).
const SUN_1405 = Date.UTC(2026, 10, 8, 14, 5);
const MON_1835 = Date.UTC(2026, 10, 9, 18, 35);
const TUE_0300 = Date.UTC(2026, 10, 10, 3, 0);
const SUN_1200 = Date.UTC(2026, 10, 8, 12, 0);

describe('cron resolution: exact text first, then the scheduled time (order 1000)', () => {
  it('an exact video key resolves as exact, and so does a scrape cron', () => {
    expect(resolveCron('5 14 * * SUN,WED,FRI', SUN_1405)).toEqual({ match: 'exact', key: '5 14 * * SUN,WED,FRI' });
    expect(resolveCron('0 3 * * *', TUE_0300)).toEqual({ match: 'exact', key: '0 3 * * *' });
  });

  it('a cron text that is not a key falls back to the scheduled time, for a video slot', () => {
    expect(resolveCron('some other text', SUN_1405)).toEqual({ match: 'fallback', key: '5 14 * * SUN,WED,FRI' });
    expect(resolveCron('some other text', MON_1835)).toEqual({ match: 'fallback', key: '35 18 * * MON,WED,FRI' });
  });

  it('a cron text that is not a key falls back to the scheduled time, for a scrape', () => {
    expect(resolveCron('some other text', TUE_0300)).toEqual({ match: 'fallback', key: '0 3 * * *' });
  });

  it('an unknown time is recorded as none, with no key', () => {
    expect(resolveCron('some other text', SUN_1200)).toEqual({ match: 'none', key: null });
  });

  it('a name that is only an object property elsewhere is not an exact match', () => {
    expect(resolveCron('constructor', SUN_1200).match).toBe('none');
    expect(resolveCron('__proto__', SUN_1405).match).toBe('fallback');
  });

  it('the time index has one entry per weekday for each configured time', () => {
    expect(Object.keys(TIME_INDEX).length).toBe(2 * 7 + 2 * 3 + 2 * 3);
    expect(Object.keys(SCRAPE_STORE_BY_CRON).length).toBe(2);
  });
});

describe('planScheduled: what each event dispatches and what the heartbeat records (order 1000)', () => {
  it('exact path: a video cron text plans its entry, with the match recorded as exact', () => {
    const p = planScheduled('5 14 * * SUN,WED,FRI', SUN_1405);
    expect(p).toEqual({ match: 'exact', resolved_cron: '5 14 * * SUN,WED,FRI', store: null, video: { file: 'video-publish-poller.yml', name: 'vidp4-slot' } });
  });

  it('fallback path: an unknown cron text at a video time plans that entry, and says the fallback was used', () => {
    const p = planScheduled('5 14 * * 1,4', SUN_1405);
    expect(p.match).toBe('fallback');
    expect(p.resolved_cron).toBe('5 14 * * SUN,WED,FRI');
    expect(p.video).toEqual({ file: 'video-publish-poller.yml', name: 'vidp4-slot' });
    expect(p.store).toBeNull();
  });

  it('fallback path for a scrape time plans the scrape for that retailer', () => {
    const p = planScheduled('something-new', TUE_0300);
    expect(p).toEqual({ match: 'fallback', resolved_cron: '0 3 * * *', store: 'mybrickhouse', video: null });
  });

  it('unknown time: nothing is planned, and the match is recorded as none', () => {
    expect(planScheduled('something-new', SUN_1200)).toEqual({ match: 'none', resolved_cron: null, store: null, video: null });
  });
});

// Order 1010: the Worker's own non-dispatch crons never reach the time fallback, so a video or scrape can't be dispatched
// by a freshness, keep-alive or load tick that happens to fall on a table time.
const OWN_CRONS = ['10 3 * * *', '17 6 * * 1,4', '* * * * *'];

describe('own crons never fall back to the time table (order 1010)', () => {
  it('the load cron "* * * * *" at a video time plans nothing', () => {
    expect(planScheduled('* * * * *', SUN_1405, OWN_CRONS)).toEqual({ match: 'none', resolved_cron: null, store: null, video: null });
  });

  it('the freshness cron "10 3 * * *" at a video time plans nothing', () => {
    expect(planScheduled('10 3 * * *', SUN_1405, OWN_CRONS)).toEqual({ match: 'none', resolved_cron: null, store: null, video: null });
  });

  it('the same texts still fall back when they are not the Worker\'s own crons, so the guard is the only thing that stops them', () => {
    expect(planScheduled('* * * * *', SUN_1405).match).toBe('fallback');
  });

  it('the list used here equals the constants in the Worker modules', () => {
    expect(read('workers/boi-scheduler/src/freshness.ts')).toContain(`FRESHNESS_CRON = '${OWN_CRONS[0]}'`);
    expect(read('workers/boi-scheduler/src/keepalive.ts')).toContain(`KEEPALIVE_CRON = '${OWN_CRONS[1]}'`);
    expect(read('workers/boi-scheduler/src/loadgen.ts')).toContain(`LOADGEN_CRON = '${OWN_CRONS[2]}'`);
  });
});
