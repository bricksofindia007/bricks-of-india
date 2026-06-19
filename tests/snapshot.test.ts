/**
 * PR-2a snapshot regression tests.
 * Verifies that the canonical prompt module (src/lib/prompts/draft-prompt.ts)
 * produces byte-identical output to the pre-refactor baseline captured in
 * tests/snapshots/ by running scripts/snapshot-capture.mjs.
 *
 * Run: npx vitest run
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt, VOICE_EXAMPLES, OUTPUT_FORMAT } from '../src/lib/prompts/draft-prompt';
import { extractSetNumberCandidates, extractSetNameCandidates, lintDraft } from '../src/lib/lint';
import { isCerebrasEligible } from '../src/lib/source-quality';

const SNAP = join(__dirname, 'snapshots');
const read = (name: string) => readFileSync(join(SNAP, name), 'utf8');

// ── Fixed fixtures — must match snapshot-capture.mjs exactly ─────────────────

const FIXTURES = {
  news: {
    format: 'news',
    sourceTitle: 'LEGO Technic Bugatti Bolide (42151) Announced for 2026',
    sourceUrl: 'https://www.brothers-brick.com/2026/06/01/lego-technic-bugatti-bolide-42151',
    sourcePublishedAt: '2026-06-01',
    setNumber: '42151',
    fullBody: null,
    sourceExcerpt: 'LEGO has announced the new Technic Bugatti Bolide set for 2026, featuring 905 pieces.',
    indiaPriceContext: 'INDIA PRICE DATA — use these exact figures, do not calculate:\n  MyBrickHouse: ₹8,999\n  Toycra: ₹8,499',
  },
  review: {
    format: 'review',
    sourceTitle: 'LEGO Creator Expert Eiffel Tower 10307 Review',
    sourceUrl: 'https://www.jaysbrickblog.com/2026/05/lego-eiffel-tower-10307-review',
    sourcePublishedAt: '2026-05-15',
    setNumber: '10307',
    fullBody: 'The LEGO Eiffel Tower 10307 is one of the most impressive sets ever released. With 10,001 pieces and standing nearly 5 feet tall when built, it commands attention from any room.',
    sourceExcerpt: null,
    indiaPriceContext: 'INDIA PRICE DATA — use these exact figures, do not calculate:\n  MyBrickHouse: ₹65,999\n  Toycra: ₹61,500',
  },
  opinion: {
    format: 'opinion',
    sourceTitle: 'Why LEGO Icons Sets Are the Best Value in 2026',
    sourceUrl: 'https://brickset.com/article/why-lego-icons-2026',
    sourcePublishedAt: '2026-05-20',
    setNumber: null,
    fullBody: null,
    sourceExcerpt: 'LEGO Icons sets continue to dominate the collector market with excellent part-per-rupee value.',
    indiaPriceContext: 'INDIA PRICE DATA: set number could not be identified from this source. Acknowledge price uncertainty; do not state a specific figure.',
  },
} as const;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('prompt snapshots', () => {
  it('system prompt matches baseline', () => {
    expect(buildSystemPrompt()).toBe(read('system.txt'));
  });

  it('user prompt (news) matches baseline', () => {
    expect(buildUserPrompt(FIXTURES.news)).toBe(read('user-news.txt'));
  });

  it('user prompt (review) matches baseline', () => {
    expect(buildUserPrompt(FIXTURES.review)).toBe(read('user-review.txt'));
  });

  it('user prompt (opinion) matches baseline', () => {
    expect(buildUserPrompt(FIXTURES.opinion)).toBe(read('user-opinion.txt'));
  });
});

// ── Prompt hardening — anti-fabrication and discipline rules ──────────────────

describe('prompt hardening — anti-fabrication rules', () => {
  it('VOICE_EXAMPLES contains anti-fabrication rules block', () => {
    expect(VOICE_EXAMPLES).toContain('ANTI-FABRICATION RULES');
    expect(VOICE_EXAMPLES).toContain('NEVER invent set names');
    expect(VOICE_EXAMPLES).toContain('NEVER use speculative product language');
  });

  it('VOICE_EXAMPLES contains correct/incorrect speculation example pair anchored to pilot failure', () => {
    expect(VOICE_EXAMPLES).toContain('GOOD:');
    expect(VOICE_EXAMPLES).toContain('BAD:');
    expect(VOICE_EXAMPLES).toContain('Panchatantra');
    expect(VOICE_EXAMPLES).toContain('Mumbai Skyline');
  });

  it('VOICE_EXAMPLES contains marker discipline rules', () => {
    expect(VOICE_EXAMPLES).toContain('INDIA PARAGRAPH MARKER DISCIPLINE');
    expect(VOICE_EXAMPLES).toContain('MUST appear INSIDE the <!-- INDIA_PARAGRAPH --> block');
  });

  it('OUTPUT_FORMAT contains verdict line discipline', () => {
    expect(OUTPUT_FORMAT).toContain('VERDICT LINE DISCIPLINE');
    expect(OUTPUT_FORMAT).toContain('EXACTLY ONCE');
  });

  it('anti-fabrication block appears BEFORE existing voice rules (prompt-position priority)', () => {
    const antiFabIdx    = VOICE_EXAMPLES.indexOf('ANTI-FABRICATION RULES');
    const voiceRulesIdx = VOICE_EXAMPLES.search(/BOI VOICE|Jeremy Clarkson|voice rules/i);
    expect(antiFabIdx).toBeGreaterThanOrEqual(0);
    if (voiceRulesIdx >= 0) {
      expect(antiFabIdx).toBeLessThan(voiceRulesIdx);
    }
  });
});

// ── Factuality extraction — pure regex, no DB ─────────────────────────────────

describe('factuality extraction', () => {
  it('extracts set numbers from LEGO context, excludes years and prices', () => {
    const body = [
      'LEGO 21066 is a stunner. Built between 2015 and 2024.',
      'The set 42688 retails at ₹6499 in India.',
      'LEGO has produced over 25000 sets since 1932.',
      'In 2026, we expect more.',
      'Look at #10365 for pirates.',
    ].join('\n');
    const nums = extractSetNumberCandidates(body).sort();
    // Included: 21066 (LEGO context), 42688 (set context), 25000 (LEGO context), 10365 (# context)
    // Excluded: 2015, 2024, 2026 (4-digit years), 1932 (year), 6499 (after ₹)
    expect(nums).toContain('21066');
    expect(nums).toContain('42688');
    expect(nums).toContain('10365');
    expect(nums).not.toContain('2015');
    expect(nums).not.toContain('2024');
    expect(nums).not.toContain('2026');
    expect(nums).not.toContain('1932');
    expect(nums).not.toContain('6499');
  });

  it('extracts set name candidates after LEGO brand', () => {
    const body = [
      'I love LEGO Hogsmeade Village. The set looks great.',
      'LEGO Star Wars Boba Fett looks amazing.',
      'LEGO Ideas has many sets.',
    ].join('\n');
    const names = extractSetNameCandidates(body);
    expect(names.some(n => n.includes('Hogsmeade'))).toBe(true);
    // "Star Wars Boba Fett" — theme-prefixed with specific product name after it
    expect(names.some(n => n.includes('Boba Fett'))).toBe(true);
    // "Ideas" alone (theme name, no specific set after it) should NOT appear as a lone entry
    expect(names.every(n => n !== 'Ideas')).toBe(true);
  });

  it('surfaces fabricated names matching the pilot 76476d96 pattern', () => {
    const body = [
      'The new LEGO Panchatantra Ideas set looks amazing.',
      'LEGO Mumbai Skyline Architecture is rumored for 2027.',
      'LEGO Pokemon Jirachi is the highlight of the leak.',
    ].join('\n');
    const names = extractSetNameCandidates(body);
    // Extraction surfaces all three — gate (DB lookup) would reject them
    expect(names.some(n => n.includes('Panchatantra'))).toBe(true);
    expect(names.some(n => n.includes('Mumbai'))).toBe(true);
    expect(names.some(n => n.includes('Jirachi'))).toBe(true);
  });

  it('does not extract generic phrases or openers as set names', () => {
    const body = [
      'LEGO has announced a new wave.',
      'LEGO fans are excited.',
      'The set comes from LEGO.',
    ].join('\n');
    const names = extractSetNameCandidates(body);
    // Single generic words or fragments should not produce falsifiable candidates
    expect(names.every(n => n.length > 4)).toBe(true);
  });
});

// ── isCerebrasEligible — source quality gating ───────────────────────────────

describe('isCerebrasEligible', () => {
  it('returns true when source_excerpt is exactly 200 chars', () => {
    expect(isCerebrasEligible({ source_excerpt: 'x'.repeat(200) })).toBe(true);
  });

  it('returns true when source_excerpt is longer than 200 chars', () => {
    expect(isCerebrasEligible({ source_excerpt: 'x'.repeat(500) })).toBe(true);
  });

  it('returns false when source_excerpt is 199 chars (boundary)', () => {
    expect(isCerebrasEligible({ source_excerpt: 'x'.repeat(199) })).toBe(false);
  });

  it('returns false when source_excerpt is short', () => {
    expect(isCerebrasEligible({ source_excerpt: 'Short excerpt.' })).toBe(false);
  });

  it('returns false when source_excerpt is null (YouTube / no excerpt)', () => {
    expect(isCerebrasEligible({ source_excerpt: null })).toBe(false);
  });

  it('returns false when source_excerpt is undefined', () => {
    expect(isCerebrasEligible({})).toBe(false);
  });
});

// ── Prompt hardening — Phase 7a (comparison discipline) ──────────────────────

describe('prompt hardening — Phase 7a comparison discipline', () => {
  it('VOICE_EXAMPLES contains one-comparison-inside-marker rule', () => {
    expect(VOICE_EXAMPLES).toContain('EXACTLY ONCE');
    expect(VOICE_EXAMPLES).toContain('One comparison. Inside. Nowhere else.');
  });

  it('VOICE_EXAMPLES contains closing marker instruction', () => {
    expect(VOICE_EXAMPLES).toContain('<!-- /INDIA_PARAGRAPH -->');
  });

  it('OUTPUT_FORMAT body hint mentions closing marker', () => {
    expect(OUTPUT_FORMAT).toContain('<!-- /INDIA_PARAGRAPH -->');
  });
});

// ── Source fidelity gate — LOW confidence sources (unit tests, no DB needed) ──

const INDIA_BLOCK = `<!-- INDIA_PARAGRAPH -->
At ₹6,499 (estimated), that's four months of Spotify Premium.
Toycra and MyBrickHouse will stock it 4–6 weeks after global launch.
<!-- /INDIA_PARAGRAPH -->`;

describe('source fidelity — LOW confidence sources', () => {
  it('fails when body claims set number not in source (YT low-confidence)', async () => {
    const body = `LEGO 99999 was shown in this video.
${INDIA_BLOCK}`;
    const result = await lintDraft({
      format:     'news',
      body,
      word_count: 350,
      source: {
        source_url:     'https://youtube.com/watch?v=abc',
        source_title:   'New LEGO leaks for next month',
        source_excerpt: null,
      },
    }, { skipHeroImage: true, skipFactuality: false });
    expect(result.gates.sourceFidelity?.pass).toBe(false);
    expect(result.gates.sourceFidelity?.severity).toBe('fail');
    expect(result.overallPass).toBe(false);
  });

  it('passes when set number is grounded in source title (YT low-confidence)', async () => {
    const body = `LEGO 21066 from this video.
${INDIA_BLOCK}`;
    const result = await lintDraft({
      format:     'news',
      body,
      word_count: 350,
      source: {
        source_url:     'https://youtube.com/watch?v=abc',
        source_title:   'LEGO 21066 revealed today',
        source_excerpt: null,
      },
    }, { skipHeroImage: true, skipFactuality: false });
    expect(result.gates.sourceFidelity?.pass).toBe(true);
  });

  it('short-circuits to ok for HIGH confidence source (excerpt >= 200 chars)', async () => {
    const body = `LEGO 99999 claimed here.
${INDIA_BLOCK}`;
    const result = await lintDraft({
      format:     'news',
      body,
      word_count: 350,
      source: {
        source_url:     'https://brickset.com/article/12345',
        source_title:   'Title',
        source_excerpt: 'A'.repeat(500),
      },
    }, { skipHeroImage: true, skipFactuality: false });
    // High confidence — gate short-circuits without checking the body
    expect(result.gates.sourceFidelity?.pass).toBe(true);
    expect(result.gates.sourceFidelity?.severity).toBe('ok');
  });

  it('is null when source context is not provided', async () => {
    const result = await lintDraft({
      format:     'news',
      body:       `Some content. ${INDIA_BLOCK}`,
      word_count: 350,
    }, { skipHeroImage: true, skipFactuality: false });
    expect(result.gates.sourceFidelity).toBeNull();
  });

  it('is null when skipFactuality is true', async () => {
    const result = await lintDraft({
      format:     'news',
      body:       `Some content. ${INDIA_BLOCK}`,
      word_count: 350,
      source:     { source_url: 'https://youtube.com/watch?v=abc', source_title: 'Title', source_excerpt: null },
    }, { skipHeroImage: true, skipFactuality: true });
    expect(result.gates.sourceFidelity).toBeNull();
  });
});

// ── AND-match — Phase 7b (fabricated combo, pure regex) ──────────────────────

describe('factuality AND-match — set name extraction (pure regex)', () => {
  it('extractSetNameCandidates surfaces "Mumbai Skyline Architecture" as a candidate', () => {
    const body = 'LEGO Mumbai Skyline Architecture is rumored for next year.';
    const names = extractSetNameCandidates(body);
    // Extraction must surface it — DB AND-match would then reject it
    expect(names.some(n => n.includes('Mumbai'))).toBe(true);
  });

  it('extractSetNameCandidates surfaces "Delhi Heritage Architecture"', () => {
    const body = 'LEGO Delhi Heritage Architecture was shown at a fan event.';
    const names = extractSetNameCandidates(body);
    expect(names.some(n => n.includes('Delhi'))).toBe(true);
  });

  it('extractSetNameCandidates surfaces "Panchatantra Ideas"', () => {
    const body = 'The new LEGO Panchatantra Ideas set is incredible.';
    const names = extractSetNameCandidates(body);
    expect(names.some(n => n.includes('Panchatantra'))).toBe(true);
  });

  it('extractSetNameCandidates surfaces "Hogsmeade Village" (real LEGO set)', () => {
    const body = 'LEGO Hogsmeade Village is available now.';
    const names = extractSetNameCandidates(body);
    expect(names.some(n => n.includes('Hogsmeade'))).toBe(true);
  });
});
