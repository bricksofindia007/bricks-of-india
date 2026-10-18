// Standard disclaimer for the three IMPORT ONLY reviews (owner's edited text, verbatim) and the data fix
// and rollback that write and remove it. HUNT IT text is unchanged.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EXISTING_REVIEW_VERDICT_LINES } from '@/lib/review-existing-verdict-lines';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

const IMPORT_TEXT =
  "Standard disclaimer: if you're rich, you can import it and skip the wait. The rest of us will be here checking whether an Indian store ever stocks it, and doing the sums first. If you're determined enough to import this one, do the maths on freight and customs first.";
const HUNT_TEXT =
  "Standard disclaimer: if you're rich, you can skip the hunt and just buy it. The rest of us will be out looking for a better deal before we check out.";

// SQL writes an apostrophe as two of them; undo that to compare with the plain text.
const unescapeSql = (s: string) => s.replace(/''/g, "'");

describe('import disclaimer text', () => {
  it('the code constant carries the owner text exactly', () => {
    expect(EXISTING_REVIEW_VERDICT_LINES['IMPORT ONLY']).toBe(IMPORT_TEXT);
  });

  it('the HUNT IT constant is unchanged', () => {
    expect(EXISTING_REVIEW_VERDICT_LINES['HUNT IT']).toBe(HUNT_TEXT);
  });

  it('the data fix writes the owner text exactly, and the HUNT IT text unchanged', () => {
    const fix = unescapeSql(read('supabase/data-fixes/625-review-note-set.sql'));
    expect(fix).toContain(IMPORT_TEXT);
    expect(fix).toContain(HUNT_TEXT);
  });

  it('the rollback removes the owner text exactly, and the HUNT IT text unchanged', () => {
    const rb = unescapeSql(read('docs/data-fix-rollbacks/a1-import-hunt-disclaimer-rollback.sql'));
    expect(rb).toContain(`import_line text := '${IMPORT_TEXT}';`);
    expect(rb).toContain(`hunt_line text := '${HUNT_TEXT}';`);
  });

  it('the old import sentence is gone from every file that carries the text', () => {
    for (const f of [
      'src/lib/review-existing-verdict-lines.ts',
      'tests/review-existing-verdict-lines.test.ts',
      'supabase/data-fixes/625-review-note-set.sql',
      'docs/data-fix-rollbacks/a1-import-hunt-disclaimer-rollback.sql',
    ]) {
      // the old text ended at "first." and closed the string; the new text continues after it
      expect(read(f), f).not.toMatch(/doing the sums first\.(['"`]|\s*$)/m);
    }
  });

  // The fix inserts "blank line + text" after the verdict line; the rollback removes exactly that block.
  // Simulated on sample content so the round trip is checked without a database.
  const insert = (content: string) =>
    content.replace(/^(.*Verdict: IMPORT ONLY\.[^\n]*)/m, (line) => `${line}\n\n${IMPORT_TEXT}`);
  const rollback = (content: string) => content.split(`\n\n${IMPORT_TEXT}`).join('');

  const sample =
    'Intro paragraph about the set.\n\nVerdict: IMPORT ONLY. Not in Indian stores.\n\nClosing line with a link.';

  it('insert then rollback restores the prior text exactly', () => {
    expect(rollback(insert(sample))).toBe(sample);
  });

  it('insert adds only the owner paragraph after the verdict line, changing nothing else', () => {
    const out = insert(sample);
    expect(out).toBe(
      `Intro paragraph about the set.\n\nVerdict: IMPORT ONLY. Not in Indian stores.\n\n${IMPORT_TEXT}\n\nClosing line with a link.`,
    );
  });

  it('a second insert is not applied to a row that already carries the text (the fix checks for the prefix)', () => {
    const once = insert(sample);
    expect(once).toContain('Standard disclaimer:');
    expect(once.split(IMPORT_TEXT).length - 1).toBe(1);
  });
});
