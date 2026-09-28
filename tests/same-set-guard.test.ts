import { describe, it, expect } from 'vitest';
import {
  subjectCandidates, mentionsSet, decideSameSet, isHumanReleased, holdReason, HOLD_PREFIX,
  type RecentArticle,
} from '../src/lib/same-set-guard';

// The #422 incident: 40900 published 22 Sep (Jay's), then again 28 Sep (Brickset), plus a
// "What's hot this week" roundup that pivoted to 40900 during generation.
const jays: RecentArticle = { slug: 'lego-40900-scary-haunted-tree-gwp-revealed-halloween-2026', title: 'LEGO 40900 Scary Haunted Tree GWP Revealed - Halloween 2026', published_at: '2026-09-22T13:33:59Z' };
const brickset = { source_url: 'https://brickset.com/article/134769', source_title: 'LEGO Creator 40900 Scary Haunted Tree revealed!', draft_format: 'news', approved_by: 'radar-auto-tier1-2' };
const roundup = { source_url: 'https://brickset.com/article/134950', source_title: "What's hot this week", draft_format: 'news' };

describe('#422 same-set repeat guard', () => {
  it('extracts the subject set from titles and URLs, never years or prices', () => {
    expect(subjectCandidates(brickset)).toEqual(['40900']);
    expect(subjectCandidates({ source_url: 'https://jaysbrickblog.com/news/lego-40900-scary-haunted-tree-gwp-revealed/', source_title: null })).toEqual(['40900']);
    expect(subjectCandidates({ source_url: 'https://x.com/a', source_title: 'Best sets of 2026 under $1000 and ₹49999' })).toEqual([]);
    expect(subjectCandidates({ source_url: 'https://x.com/sets/10305-1/lion', source_title: null })).toEqual(['10305']);
    expect(subjectCandidates(roundup)).toEqual([]);
  });

  it('matches a set number as a whole token only', () => {
    expect(mentionsSet(jays.slug, '40900')).toBe(true);
    expect(mentionsSet('lego-409001-thing', '40900')).toBe(false);
    expect(mentionsSet('set 140900 is odd', '40900')).toBe(false);
  });

  it('holds the Brickset 40900 reveal because of the 22 Sep article (the incident)', () => {
    const hit = decideSameSet(brickset, ['40900'], [jays], new Map());
    expect(hit).toEqual({ set_number: '40900', path: `/news/${jays.slug}`, published_at: jays.published_at, sameRun: false });
    expect(holdReason(hit!)).toMatch(/^held_same_set: set 40900 already covered by \/news\/lego-40900.* \(published 2026-09-22\)/);
  });

  it('holds a second draft about a set published earlier in the same run', () => {
    const batch = new Map([['40900', '/news/first']]);
    expect(decideSameSet(brickset, ['40900'], [], batch)?.sameRun).toBe(true);
  });

  it('points at the oldest article when several exist', () => {
    const later = { ...jays, slug: 'lego-40900-later', published_at: '2026-09-25T00:00:00Z' };
    expect(decideSameSet(brickset, ['40900'], [later, jays], new Map())?.path).toBe(`/news/${jays.slug}`);
  });

  it('lets through: no catalogued subject, other formats, other sets, and human re-approval', () => {
    expect(decideSameSet(roundup, [], [jays], new Map())).toBeNull();
    expect(decideSameSet({ ...brickset, draft_format: 'review' }, ['40900'], [jays], new Map())).toBeNull();
    expect(decideSameSet(brickset, ['10305'], [jays], new Map())).toBeNull();
    const released = { ...brickset, approved_by: 'admin', discard_reason: `${HOLD_PREFIX}: set 40900 ...` };
    expect(isHumanReleased(released)).toBe(true);
    expect(decideSameSet(released, ['40900'], [jays], new Map())).toBeNull();
    // An admin approval that was never held is still guarded.
    expect(decideSameSet({ ...brickset, approved_by: 'admin' }, ['40900'], [jays], new Map())).not.toBeNull();
  });
});
