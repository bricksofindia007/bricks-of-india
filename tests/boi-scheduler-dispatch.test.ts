import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { VIDEO_DISPATCH, dispatchWorkflow } from '../workers/boi-scheduler/src/dispatch';

// Order 0970: the scheduler Worker triggers the two video publish pollers at their slot times, and once more an hour later.

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

// wrangler.jsonc is JSONC: drop the whole-line // comments, then parse.
const wrangler = JSON.parse(read('workers/boi-scheduler/wrangler.jsonc').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n'));
const SCRAPE_CRONS = ['0 3 * * *', '5 3 * * *'];

// IST = UTC + 5h30. Minutes of the day in IST for a UTC cron (hour, minute).
const istMinute = (cron: string) => {
  const [m, h] = cron.split(' ').map(Number);
  return (h * 60 + m + 330) % 1440;
};
const hhmm = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
const utcDays = (cron: string) => cron.split(' ')[4].split(',').map(Number);

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
    expect(hhmm(istMinute('5 14 * * 0,3,5'))).toBe('19:35');
    expect(hhmm(istMinute('5 15 * * 0,3,5'))).toBe('20:35');
  });

  it('VID-QP dispatches 5 minutes after the 00:00 IST slot, and again 60 minutes later', () => {
    expect(hhmm(istMinute('35 18 * * 1,3,5'))).toBe('00:05');
    expect(hhmm(istMinute('35 19 * * 1,3,5'))).toBe('01:05');
  });

  it('the VID-P4 UTC days are the IST slot days (Sun, Wed, Fri), the same calendar day', () => {
    expect(utcDays('5 14 * * 0,3,5')).toEqual([0, 3, 5]); // JS: 0 Sun, 3 Wed, 5 Fri
  });

  it('the VID-QP UTC days are the day before the IST slot days (Tue, Thu, Sat IST), because 00:05 IST is the previous UTC day', () => {
    const istDays = utcDays('35 18 * * 1,3,5').map((d) => (d + 1) % 7); // JS: Tue 2, Thu 4, Sat 6
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
