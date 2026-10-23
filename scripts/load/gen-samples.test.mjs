// Checks for gen-samples.mjs pure functions. Run: node scripts/load/gen-samples.test.mjs
import assert from 'node:assert/strict';
import { templateToRegex, groupPaths, samplesFrom, pathsFromSitemap } from './gen-samples.mjs';

const T = ['/', '/sets/[slug]', '/themes/[theme]', '/themes/[theme]/sort/[sort]', '/compare'];
assert.ok(templateToRegex('/sets/[slug]').test('/sets/75192-ufo'));
assert.ok(!templateToRegex('/sets/[slug]').test('/sets/75192/x'));

const groups = groupPaths(['/sets/1-a', '/sets/2-b', '/themes/city', '/themes/city/sort/price-asc', '/compare', '/sets/3?x=1', '/nope'], T);
assert.deepEqual(groups.get('/sets/[slug]'), ['/sets/1-a', '/sets/2-b'], 'query strings are skipped');
assert.deepEqual(groups.get('/themes/[theme]/sort/[sort]'), ['/themes/city/sort/price-asc'], 'sorted view gets its own class');
assert.deepEqual(groups.get('/themes/[theme]'), ['/themes/city']);
assert.deepEqual(groups.get('/nope'), undefined, 'unknown paths are not grouped');

const s = samplesFrom(groups, 1);
assert.deepEqual(s['/sets/[slug]'], ['/sets/1-a']);
assert.equal('/' in s, false, 'templates with no paths are omitted');

const xml = '<urlset><url><loc>https://s.example/sets/1-a</loc></url><url><loc>https://other.example/x</loc></url><url><loc>https://s.example/compare</loc></url></urlset>';
assert.deepEqual(pathsFromSitemap(xml, 'https://s.example'), ['/sets/1-a', '/compare']);
console.log('gen-samples checks passed');
