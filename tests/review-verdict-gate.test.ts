import { describe, it, expect } from 'vitest';
import { lintDraft } from '../src/lib/lint';
import { PublishInsertError } from '../src/lib/publish-draft';

// #387: a review-format draft with no verdict can never be stored
// (reviews.verdict NOT NULL), so it must FAIL lint (-> reject+delete), not
// pass as "community content" and then fail the insert on every run.
const body = [
  'LEGO has announced a new set. It looks great on a shelf and builds in an evening.',
  '',
  '<!-- INDIA_PARAGRAPH -->',
  'In India it lists at ₹4,999 on Toycra, roughly two months of Spotify.',
].join('\n');

describe('Gate 3 verdict for review-format drafts (#387)', () => {
  it('review with no verdict fails the verdict gate and overall', async () => {
    const r = await lintDraft({ format: 'review', body, verdict: null }, { skipFactuality: true });
    expect(r.gates.verdict?.pass).toBe(false);
    expect(r.gates.verdict?.severity).toBe('fail');
    expect(r.overallPass).toBe(false);
  });
  it('opinion with no verdict keeps the community carve-out (warn, not fail)', async () => {
    const r = await lintDraft({ format: 'opinion', body, verdict: null }, { skipFactuality: true });
    expect(r.gates.verdict?.pass).toBe(true);
    expect(r.gates.verdict?.severity).toBe('warn');
  });
  it('review with a valid verdict passes the verdict gate', async () => {
    const r = await lintDraft({ format: 'review', body, verdict: 'WAIT' }, { skipFactuality: true });
    expect(r.gates.verdict?.pass).toBe(true);
  });
});

describe('PublishInsertError.permanent (#387)', () => {
  it('class-23 integrity violations are permanent; others are not', () => {
    expect(new PublishInsertError('reviews', 'null value in column "verdict"', '23502').permanent).toBe(true);
    expect(new PublishInsertError('reviews', 'duplicate key', '23505').permanent).toBe(true);
    expect(new PublishInsertError('reviews', 'timeout', '57014').permanent).toBe(false);
    expect(new PublishInsertError('reviews', 'network', undefined).permanent).toBe(false);
  });
});
