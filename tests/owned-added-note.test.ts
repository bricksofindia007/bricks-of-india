// The add-to-collection confirmation must stay on screen after the set is added. After an add, the button shows the
// copies view, so that view must render the status line too. Checked in the source (no DOM test setup in this repo).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, '..', 'src/components/saved/SaveButtons.tsx'), 'utf8');

describe('AddToCollectionButton confirmation', () => {
  const start = src.indexOf('export function AddToCollectionButton');
  const copies = src.indexOf('In My Collection', start);
  const body = src.slice(copies, src.indexOf('\n}', copies));

  it('the copies view renders the status line when there is a note', () => {
    expect(copies).toBeGreaterThan(start);
    expect(body).toMatch(/\{note && <span role="status"[^>]*>\{note\}<\/span>\}/);
  });

  it('the add-to-collection view still renders the status line', () => {
    const addView = src.slice(start, copies);
    expect(addView).toMatch(/\{note && <span role="status"[^>]*>(\{note\}|<NoteText text=\{note\} \/>)<\/span>\}/);
  });

  it('the confirmation text is the approved line, unchanged', () => {
    const lib = readFileSync(join(__dirname, '..', 'src/lib/my-collection.ts'), 'utf8');
    expect(lib).toContain("ownedAdded: 'Yours now. Own it proudly.'");
  });
});
