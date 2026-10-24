// Checks for build-profile.mjs pure functions. Run: node scripts/load/build-profile.test.mjs
import assert from 'node:assert/strict';
import { templateToRegex, excluded, classify, shapeOf, unmatchedShapes } from './build-profile.mjs';

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
assert.equal(r.classifiedCount, 155, 'unknown paths are not classified');
assert.equal(shapeOf('/sets/75192-ufo'), '/sets/[x]');
assert.equal(shapeOf('/themes/city/sort/price-asc'), '/themes/city/sort/[x]');
assert.equal(shapeOf('/'), '/');
assert.equal(shapeOf('/sets/12345/'), '/sets/[x]/');
const shapes = unmatchedShapes([...paths, { path: '/unknown/abc-123', count: 3 }, { path: '/unknown/xyz-999', count: 4 }], T, 20);
assert.deepEqual(shapes, [{ shape: '/unknown/thing', requests: 7 }, { shape: '/unknown/[x]', requests: 7 }], 'unmatched paths are grouped by shape; ids become [x]; no full paths');
assert.equal(unmatchedShapes(paths, T, 1).length, 1, 'limit applies');
console.log('build-profile checks passed');
