// Review text fixes, data fix 563 (order 1580 item 3). The SQL is not run here (no database in tests); the marker rule is
// run on sample texts, and the SQL, the rollback and the approved wording are checked as text.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MARKER, insertMarker } from '../scripts/data-fix-logic/review-marker.mjs';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const SQL = read('supabase/data-fixes/563-review-text-fixes-2026-11-08.sql');
const ROLLBACK = read('docs/data-fix-rollbacks/563-review-text-fixes-2026-11-08-rollback.sql');

const count = (s: string, needle: string) => s.split(needle).length - 1;

describe('marker B: runs on three sample texts', () => {
  it('sample 1: an abbreviation (Mrs.) in the first price paragraph; the marker lands once, after the whole paragraph', () => {
    const text = [
      'Intro line with no price.',
      'Mrs. Patel bought it for ₹2,499 last week. She said the bricks were sorted well. Mrs. Patel also liked the minifig.',
      'Verdict: BUY NOW.',
    ].join('\n\n');
    const out = insertMarker(text);
    const paras = out.split('\n\n');
    expect(paras).toEqual([
      'Intro line with no price.',
      'Mrs. Patel bought it for ₹2,499 last week. She said the bricks were sorted well. Mrs. Patel also liked the minifig.',
      MARKER,
      'Verdict: BUY NOW.',
    ]);
    expect(count(out, MARKER)).toBe(1);
    // the marker is not inside the price paragraph and not split from it
    expect(out).not.toMatch(/Mrs\. Patel also liked the minifig\.\n[^\n]*Prices move/);
  });

  it('sample 2: the first rupee paragraph comes after two paragraphs without one; only that paragraph gets the marker', () => {
    const text = [
      'Opening paragraph about the box.',
      'The build took an afternoon.',
      'At ₹10,999 it sits in the middle of the range.',
      'A later paragraph also has ₹12,000 in it.',
    ].join('\n\n');
    const out = insertMarker(text);
    expect(out.split('\n\n')).toEqual([
      'Opening paragraph about the box.',
      'The build took an afternoon.',
      'At ₹10,999 it sits in the middle of the range.',
      MARKER,
      'A later paragraph also has ₹12,000 in it.',
    ]);
    expect(count(out, MARKER)).toBe(1);
  });

  it('sample 3: no rupee figure, so the text is unchanged; a second run changes nothing', () => {
    const text = 'A review with no price in it at all.\n\nStill no price here.';
    expect(insertMarker(text)).toBe(text);
    const once = insertMarker('Price: ₹4,999.\n\nMore words.');
    expect(insertMarker(once)).toBe(once);
    expect(count(insertMarker(once), MARKER)).toBe(1);
  });
});

describe('marker B: the wording is the approved text', () => {
  it('the marker is the exact approved sentence, as an italic paragraph', () => {
    expect(MARKER).toBe("*Prices move faster than a minifig loses its hat. The figure here is from when we wrote this. We check prices daily, so the set page has today's.*");
  });
  it('the SQL uses the same marker text in the update and in both checks', () => {
    const sqlMarker = "*Prices move faster than a minifig loses its hat. The figure here is from when we wrote this. We check prices daily, so the set page has today''s.*";
    expect(count(SQL, sqlMarker.replace(/''/g, "'"))).toBeGreaterThan(0);
    expect(count(SQL, "today''s.*')")).toBeGreaterThan(0); // the assert literal escapes the quote
  });
});

describe('piece counts, 40912 price and the dated notes (SQL text)', () => {
  it('changes only the numbers named by the owner', () => {
    expect(SQL).toContain("$q$You've got 708 pieces here$q$, $q$You've got 1,212 pieces here$q$");
    expect(SQL).toContain("$q$The piece count is 708, still enough$q$, $q$The piece count is 1,212, still enough$q$");
    expect(SQL).toContain("$q$you get 1,411 pieces of$q$, $q$you get 1,406 pieces of$q$");
    expect(SQL).toContain("$q$At 1,411 pieces, this is$q$, $q$At 1,406 pieces, this is$q$");
    expect(SQL).toContain("$q$Heartlake City Grand Hotel has 1,411 pieces.$q$, $q$Heartlake City Grand Hotel has 1,406 pieces.$q$");
    expect(SQL).toContain("$q$It's got 579 pieces.$q$, $q$It's got 572 pieces.$q$");
    expect(SQL).toContain("$q$Kakamora Barge has 579 pieces.$q$, $q$Kakamora Barge has 572 pieces.$q$");
    expect(SQL).toContain("$q$If you can swing the ₹23,300 price tag$q$, $q$If you can swing the ₹2,499 price tag$q$");
    expect(SQL).toContain("It started life as a gift with purchase, but LEGO.in now sells it on its own, no shopping spree required.");
  });
  it('appends the dated notes exactly (G16: appended, nothing removed)', () => {
    expect(SQL).toContain('*Correction (8 November 2026): an earlier version of this review gave the wrong piece count. It now matches the official count.*');
    expect(SQL).toContain('*Correction (8 November 2026): an earlier version of this review gave the wrong price and said the set had no Indian price. It now matches the current store price.*');
  });
  it('does not change the 40912 slug, title, seo_title, excerpt or the US$180 lines', () => {
    const body = SQL.split('\n').filter((l) => !l.startsWith('--')).join('\n');
    const updates = body.split(/^UPDATE /m).slice(1);
    for (const u of updates) {
      expect(u).not.toMatch(/SET (title|seo_title|excerpt|slug|seo_description)\b/);
      expect(u).not.toMatch(/US\$180/);
    }
  });
  it('the expect-before and expect-after asserts are single numbers: 68 before, 63 after', () => {
    const before = SQL.split('\n').find((l) => l.startsWith('-- boi:expect-before'));
    const after = SQL.split('\n').find((l) => l.startsWith('-- boi:expect-after'));
    expect(before).toMatch(/then 68 else 0 end = 68$/);
    expect(after).toMatch(/then 63 else 0 end = 63$/);
  });
  it('the after-assert expects the old text gone, and the marker exactly once', () => {
    const after = SQL.split('\n').find((l) => l.startsWith('-- boi:expect-after')) ?? '';
    expect(after).toMatch(/position\('708 pieces' in content\) > 0\) = 0/);
    expect(after).toMatch(/position\('1,411' in content\) > 0\) = 0/);
    expect(after).toMatch(/position\('579 pieces' in content\) > 0\) = 0/);
    expect(after).toMatch(/length\(content\) - length\(replace\(content, /);
  });
  it('the marker is placed after the first rupee paragraph, and skips rows that already have it', () => {
    expect(SQL).toMatch(/WHERE u\.p ~ '₹\\s\?\[0-9\]'/);
    expect(SQL).toMatch(/position\(\$q\$\*Prices move faster[^]*in r0\.content\) = 0/);
    expect(SQL).toMatch(/published_at <= now\(\)/);
    expect(SQL).toMatch(/coalesce\(r0\.source_retailer, ''\) = ''/);
  });
  it('is a file in the approved place, with the issue header and the backup line', () => {
    expect(SQL.startsWith('-- boi:issue 563\n-- boi:backup-tables public.reviews\n')).toBe(true);
  });
});

describe('rollback restores each changed row exactly', () => {
  it('restores from the newest reviews backup, only the changed rows, by id', () => {
    expect(ROLLBACK).toMatch(/table_name LIKE 'public__reviews__%'/);
    expect(ROLLBACK).toMatch(/SET content = b\.content/);
    expect(ROLLBACK).toMatch(/WHERE b\.id = r\.id/);
    expect(ROLLBACK).toMatch(/AND r\.content IS DISTINCT FROM b\.content/);
  });
  it('names the same five slugs as the fix', () => {
    for (const slug of [
      'lego-dragon-stone-shrine-71819-worth-11899',
      'lego-heartlake-city-grand-hotel-42704-worth-15999',
      'lego-heartlake-city-grand-hotel-42704-worth-15999-2',
      'lego-kakamora-barge-43258-worth-10999',
      'lego-40912-sea-serpent-gwp-2026-worth-the-23300-price-tag',
    ]) {
      expect(ROLLBACK, slug).toContain(slug);
    }
  });
});
