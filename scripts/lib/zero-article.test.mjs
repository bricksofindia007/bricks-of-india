// Run: node --test scripts/lib/zero-article.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zeroArticleAlert } from './zero-article.mjs';

const done = { started_at: '2026-10-17T08:30:00Z', ended_at: '2026-10-17T08:41:00Z', drafts_attempted: 4, drafts_succeeded: 0 };

test('a completed run that attempted drafts and published none alerts', () => {
  assert.equal(zeroArticleAlert(done).alert, true);
});

test('a run that published at least one article does not alert', () => {
  assert.equal(zeroArticleAlert({ ...done, drafts_succeeded: 1 }).alert, false);
});

test('a run with nothing queued does not alert', () => {
  assert.equal(zeroArticleAlert({ ...done, drafts_attempted: 0 }).alert, false);
});

test('a run still in progress does not alert', () => {
  assert.equal(zeroArticleAlert({ ...done, ended_at: null }).alert, false);
});

test('no run recorded does not alert (the staleness check covers that)', () => {
  assert.equal(zeroArticleAlert(null).alert, false);
});
