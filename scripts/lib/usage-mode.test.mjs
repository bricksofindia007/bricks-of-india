// Tests for scripts/lib/usage-mode.mjs. Run: node --test scripts/lib/usage-mode.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { modeForFraction, prorated, evaluateMetric, evaluateUsage, flagFor, dailyLine, THRESHOLDS } from './usage-mode.mjs';

const metric = (name, used, allowance, dayOfCycle = 15, cycleDays = 30) => ({ name, unit: 'x', used, allowance, dayOfCycle, cycleDays });

test('thresholds are 60, 80 and 95 percent', () => {
  assert.deepEqual(THRESHOLDS, { warn: 0.6, shed: 0.8, minimum: 0.95 });
});

test('each threshold changes the mode, boundaries inclusive', () => {
  assert.equal(modeForFraction(0), 'normal');
  assert.equal(modeForFraction(0.599), 'normal');
  assert.equal(modeForFraction(0.6), 'warn');
  assert.equal(modeForFraction(0.799), 'warn');
  assert.equal(modeForFraction(0.8), 'shed');
  assert.equal(modeForFraction(0.949), 'shed');
  assert.equal(modeForFraction(0.95), 'minimum');
  assert.equal(modeForFraction(1.2), 'minimum');
});

test('a missing reading is unknown, never shed or minimum', () => {
  assert.equal(modeForFraction(NaN), 'unknown');
  assert.equal(modeForFraction(undefined), 'unknown');
  const r = evaluateMetric(metric('Supabase egress', null, 5));
  assert.equal(r.mode, 'unknown');
  assert.equal(r.fraction, null);
});

test('a zero or missing allowance is unknown', () => {
  assert.equal(evaluateMetric(metric('Gemini', 10, 0)).mode, 'unknown');
  assert.equal(evaluateMetric(metric('Gemini', 10, undefined)).mode, 'unknown');
});

test('pro-rated pace follows the day of the cycle', () => {
  assert.equal(prorated(30, 15, 30), 15);
  assert.equal(prorated(30, 30, 30), 30);
  assert.equal(prorated(30, 0, 30), 0);
  assert.equal(prorated(30, 99, 30), 30, 'day is capped at the cycle length');
  assert.equal(prorated(0, 15, 30), null);
});

test('the overall mode is the worst metric', () => {
  const r = evaluateUsage([metric('Cloudflare', 10, 100), metric('Supabase', 85, 100), metric('Gemini', 20, 100)]);
  assert.equal(r.mode, 'shed');
  assert.equal(r.flag.servePageCacheOnly, true);
  assert.equal(r.flag.publicPagesAndUptimeOnly, false);
});

test('minimum mode keeps only public pages and uptime', () => {
  const r = evaluateUsage([metric('Gemini', 96, 100)]);
  assert.equal(r.mode, 'minimum');
  assert.deepEqual(r.flag, {
    mode: 'minimum',
    servePageCacheOnly: true,
    skipCacheRefreshWrites: true,
    schedulerEssentialOnly: true,
    publicPagesAndUptimeOnly: true,
  });
});

test('warn changes no flag; shed sets the shed flags but not minimum', () => {
  assert.deepEqual(flagFor('warn'), {
    mode: 'warn',
    servePageCacheOnly: false,
    skipCacheRefreshWrites: false,
    schedulerEssentialOnly: false,
    publicPagesAndUptimeOnly: false,
  });
  const shed = flagFor('shed');
  assert.equal(shed.servePageCacheOnly, true);
  assert.equal(shed.skipCacheRefreshWrites, true);
  assert.equal(shed.schedulerEssentialOnly, true);
  assert.equal(shed.publicPagesAndUptimeOnly, false);
});

test('an unreadable metric warns at most; it does not switch the site off', () => {
  const r = evaluateUsage([metric('Supabase', null, 5), metric('Gemini', 10, 100)]);
  assert.equal(r.mode, 'unknown', 'unknown is reported, but it sets no flag');
  assert.equal(r.flag.servePageCacheOnly, false);
  const r2 = evaluateUsage([metric('Supabase', null, 5), metric('Gemini', 65, 100)]);
  assert.equal(r2.mode, 'warn');
  assert.equal(r2.flag.servePageCacheOnly, false);
});

test('clearing the usage restores normal running on the next run', () => {
  const hot = evaluateUsage([metric('Cloudflare', 90, 100)]);
  assert.equal(hot.flag.servePageCacheOnly, true);
  const cleared = evaluateUsage([metric('Cloudflare', 10, 100)]);
  assert.equal(cleared.mode, 'normal');
  assert.equal(cleared.flag.servePageCacheOnly, false);
  assert.equal(cleared.flag.schedulerEssentialOnly, false);
});

test('each mode is reached from its own usage level, and back again', () => {
  const levels = [[50, 'normal'], [70, 'warn'], [85, 'shed'], [97, 'minimum'], [10, 'normal']];
  for (const [used, mode] of levels) {
    assert.equal(evaluateUsage([metric('Gemini', used, 100)]).mode, mode, `used ${used}`);
  }
});

test('the daily line names the mode and each metric', () => {
  const r = evaluateUsage([metric('Cloudflare', 62, 100, 15, 30), metric('Gemini', null, 100)]);
  assert.equal(r.line, '[usage] mode warn: Cloudflare 62%, pace 124% of pro-rated; Gemini unreadable');
  assert.equal(dailyLine('normal', []), '[usage] mode normal: ');
});
