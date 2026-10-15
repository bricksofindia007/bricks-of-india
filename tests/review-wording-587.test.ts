import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const FILE = resolve(__dirname, '../supabase/data-fixes/587-review-wording-unlisted-sets.sql');
const sql = readFileSync(FILE, 'utf8');

const SLUGS = [
  'lego-77059-timmy-tommys-fun-day-out-worth-5400',
  'lego-olivia-rodrigos-dual-guitar-43031-worth-15400',
  'lego-sagrada-famlia-21065-worth-76400',
  'lego-sagrada-famlia-21065-worth-76400-2',
  'lego-ideas-21373-downton-abbey-worth-33600',
  'lego-mewtwos-lab-break-72163-worth-6700',
  'lego-privateer-frigate-fortuna-910059-a-pirates-dream-or-a-w',
];

// One entry per edit in the fix (11 edits across 7 reviews). The same old text can appear in
// more than one review, so each entry's expected count is how many entries share its old text.
const EDITS: Array<{ old: string; new: string }> = [
  { old: 'At ₹5,400 (official MRP), that\'s 12 months of Spotify Premium.', new: 'At an expected ₹5,400 (our estimate; LEGO India hasn\'t confirmed it), that\'s 12 months of Spotify Premium.' },
  { old: 'now is the moment to click “add to cart.”', new: 'wait for the Indian listing, then click “add to cart.”' },
  { old: 'Verdict: BUY NOW. The price is right — grab it.', new: 'Verdict: WAIT. Good set, but you can\'t buy it in India yet.' },
  { old: 'Standard disclaimer: if you\'ve got the money, obviously buy it — that\'s what the verdict says too, for once we all agree.', new: 'Standard disclaimer: if you\'re rich, you can skip the verdict and just buy it. The rest of us will be here doing math before we hit checkout.' },
  { old: 'Verdict: BUY NOW. The price is right — grab it.', new: 'Verdict: WAIT. Good set, but official Indian pricing isn\'t announced yet.' },
  { old: 'Standard disclaimer: if you\'ve got the money, obviously buy it — that\'s what the verdict says too, for once we all agree.', new: 'Standard disclaimer: if you\'re rich, you can skip the verdict and just buy it. The rest of us will be here doing math before we hit checkout.' },
  { old: 'has an official MRP of ₹76,400', new: 'has an expected price of ₹76,400 (our estimate; LEGO India hasn\'t confirmed it)' },
  { old: 'carries an official MRP of ₹76,400', new: 'carries an expected price of ₹76,400 (our estimate; LEGO India hasn\'t confirmed it)' },
  { old: 'The set is listed with an official MRP of ₹33,600.', new: 'The set has an expected price of ₹33,600 (our estimate; LEGO India hasn\'t confirmed it).' },
  { old: 'At ₹6,700 (official MRP),', new: 'At an expected ₹6,700 (our estimate; LEGO India hasn\'t confirmed it),' },
  { old: 'has an official MRP of ₹31,500', new: 'has an expected price of ₹31,500 (our estimate; LEGO India hasn\'t confirmed it)' },
];

const count = (haystack: string, needle: string) => haystack.split(needle).length - 1;

describe('data fix 587 (review wording, unlisted sets)', () => {
  it('has the issue header and the backup table', () => {
    expect(sql).toContain('-- boi:issue 587');
    expect(sql).toContain('-- boi:backup-tables public.reviews');
  });

  it('has before and after counts (7 and 6)', () => {
    expect(sql).toMatch(/-- boi:expect-before .* = 7\n/);
    expect(sql).toMatch(/-- boi:expect-after .* = 6\n/);
  });

  it('touches only the seven expected reviews', () => {
    const found = [...new Set(sql.match(/lego-[a-z0-9-]+-worth-\d+(-\d+)?|lego-privateer-[a-z0-9-]+/g) ?? [])].sort();
    expect(found).toEqual([...SLUGS].sort());
  });

  it('does not touch the excluded review or the witty line', () => {
    expect(sql).not.toContain('lego-gremlins-gizmo-and-stripe-40919');
    expect(sql).not.toContain('40919');
    expect(sql).not.toContain('Good set, but the price will drop.');
  });

  it('has each old and new text once per review that uses it', () => {
    expect(EDITS.length).toBe(11);
    for (const e of EDITS) {
      const sharesOld = EDITS.filter((x) => x.old === e.old).length;
      const sharesNew = EDITS.filter((x) => x.new === e.new).length;
      expect(count(sql, e.old), `old text: ${e.old}`).toBe(sharesOld);
      expect(count(sql, e.new), `new text: ${e.new}`).toBe(sharesNew);
    }
  });

  it('contains no transaction statements of its own (outside the DO body)', () => {
    // Same rule the migration runner applies: dollar-quoted bodies are removed before looking.
    const outside = sql.replace(/\$([a-z]*)\$[\s\S]*?\$\1\$/g, '');
    expect(outside).not.toMatch(/^\s*(BEGIN|COMMIT|ROLLBACK)\b/im);
  });
});
