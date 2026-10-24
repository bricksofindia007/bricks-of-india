// Checks for build-profile.mjs pure functions. Run: node scripts/load/build-profile.test.mjs
import assert from 'node:assert/strict';
import { templateToRegex, excluded, classify, shapeOf, unmatchedShapes, NOT_FOUND_CLASS, statusClass, aggregatePaths, unmatchedSummary, ROW_LIMIT, hourlySlices, combineSlices } from './build-profile.mjs';

const T = ['/', '/sets/[slug]', '/themes/[theme]', '/themes/[theme]/sort/[sort]', '/themes/[theme]/sort/[sort]/page/[page]', '/reviews/[slug]', '/news/[slug]', '/compare', '/sets'];

assert.ok(templateToRegex('/sets/[slug]').test('/sets/75192-ufo'));
assert.ok(!templateToRegex('/sets/[slug]').test('/sets/75192/extra'));
assert.ok(templateToRegex('/').test('/'));
assert.ok(!templateToRegex('/').test('/x'));
assert.ok(templateToRegex('/themes/[theme]/sort/[sort]/page/[page]').test('/themes/city/sort/price-asc/page/2'));
assert.ok(templateToRegex('/compare').test('/compare/'));

assert.equal(excluded('/_next/static/a.js'), true);
assert.equal(excluded('/api/sets/search'), true);
assert.equal(excluded('/images/x.webp'), true);
assert.equal(excluded('/sets/75192-ufo'), false);

const paths = [
  { path: '/sets/75192-ufo', count: 100 },
  { path: '/themes/city/sort/price-asc', count: 40 },
  { path: '/themes/city', count: 10 },
  { path: '/reviews/lego-x-1', count: 5 },
  { path: '/_next/static/x.js', count: 1000 },
  { path: '/unknown/thing', count: 7 },
];
const r = classify(paths, T);
assert.equal(r.excludedCount, 1000);
assert.equal(r.classes.get('/sets/[slug]'), 100);
assert.equal(r.classes.get('/themes/[theme]/sort/[sort]'), 40, 'sorted view goes to its own class, not the theme class');
assert.equal(r.classes.get('/themes/[theme]'), 10);
assert.equal(r.classes.get(NOT_FOUND_CLASS), 7, 'unmatched paths form the not-found class');
assert.equal(r.classifiedCount, 162, 'the not-found class counts toward coverage; the denominator is unchanged');
assert.equal(shapeOf('/sets/75192-ufo'), '/sets/[x]');
assert.equal(shapeOf('/themes/city/sort/price-asc'), '/themes/city/sort/[x]');
assert.equal(shapeOf('/'), '/');
assert.equal(shapeOf('/sets/12345/'), '/sets/[x]/');
const shapes = unmatchedShapes([...paths, { path: '/unknown/abc-123', count: 3 }, { path: '/unknown/xyz-999', count: 4 }], T, 20);
assert.deepEqual(shapes, [{ shape: '/unknown/thing', requests: 7 }, { shape: '/unknown/[x]', requests: 7 }], 'unmatched paths are grouped by shape; ids become [x]; no full paths');
assert.equal(unmatchedShapes(paths, T, 1).length, 1, 'limit applies');
assert.equal(statusClass(200), '2xx');
assert.equal(statusClass(301), '3xx');
assert.equal(statusClass(404), '4xx');
assert.equal(statusClass(503), '5xx');
assert.equal(statusClass(undefined), 'other');
const agg = aggregatePaths([{ path: '/x', status: 200, count: 5 }, { path: '/x', status: 404, count: 3 }, { path: '/y', status: 500, count: 2 }]);
assert.deepEqual(agg.find((e) => e.path === '/x'), { path: '/x', count: 8, classes: { '2xx': 5, '3xx': 0, '4xx': 3, '5xx': 0, other: 0 } });
assert.equal(agg.find((e) => e.path === '/y').classes['5xx'], 2);
const summ = unmatchedSummary([...agg, { path: '/a-1', count: 4, classes: { '2xx': 0, '3xx': 0, '4xx': 4, '5xx': 0, other: 0 } }, { path: '/search', count: 9, classes: { '2xx': 0, '3xx': 0, '4xx': 9, '5xx': 0, other: 0 } }], T, 1);
assert.equal(summ.top.length, 1);
assert.equal(summ.top[0].shape, '/search', 'largest shape first');
assert.equal(summ.others.requests, 14, 'everything below the top shape is the other total: /x 8 + /y 2 + /[x] 4');
assert.equal(summ.others.shapes, 3);
assert.equal(ROW_LIMIT, 10000);
const H0 = Date.parse('2026-10-17T00:00:00Z');
const H7 = H0 + 7 * 24 * 3600e3;
const hs = hourlySlices(H0, H7);
assert.equal(hs.length, 168, 'seven days of hourly slices');
assert.equal(hs[0].start, '2026-10-17T00:00:00.000Z');
assert.equal(hs[167].end, '2026-10-24T00:00:00.000Z', 'the last slice ends at the window end');
for (let i = 1; i < hs.length; i++) assert.equal(hs[i].start, hs[i - 1].end, 'slices are contiguous');
assert.deepEqual(hourlySlices(H0, H0 + 90 * 60e3).map((s) => s.end), ['2026-10-17T01:00:00.000Z', '2026-10-17T01:30:00.000Z'], 'a partial last slice ends at the window end');
const c = combineSlices([100, 200], [[{ path: '/a', status: 200, count: 60 }, { path: '/b', status: 404, count: 40 }], [{ path: '/a', status: 200, count: 150 }]], 2);
assert.equal(c.total, 300, 'denominator is the sum of the separate totals');
assert.equal(c.rows.length, 3, 'rows from every slice');
assert.equal(c.returned, 250);
assert.equal(c.outside, 50, 'requests outside returned rows = denominator minus returned');
assert.equal(c.slices, 2);
assert.equal(c.slicesAtLimit, 1, 'a slice whose rows reach the limit is counted');
const c0 = combineSlices([50], [[{ path: '/a', status: 200, count: 50 }]], 10);
assert.equal(c0.outside, 0, 'nothing outside when every request is returned');
assert.equal(c0.slicesAtLimit, 0);
const cNoRows = combineSlices([10, 20], [[], []], 10);
assert.equal(cNoRows.total, 30, 'the denominator does not depend on the rows');
assert.equal(cNoRows.outside, 30);
console.log('build-profile checks passed');
