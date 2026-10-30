// A signed-out visitor who taps "Add to my collection" is asked to sign up (approved line 3, D-2026-10-29-05). Nothing is
// added for them. Only while accounts are on. Source checks (no DOM test setup in this repo).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VOICE } from '../src/lib/my-collection';

const root = join(__dirname, '..');
const buttons = readFileSync(join(root, 'src/components/saved/SaveButtons.tsx'), 'utf8');
const addButton = buttons.slice(buttons.indexOf('export function AddToCollectionButton'));
const setPage = readFileSync(join(root, 'src/app/sets/[slug]/page.tsx'), 'utf8');

describe('the guest add line', () => {
  it('is the approved text, exactly', () => {
    expect(VOICE.guestAddNote).toBe('Your shelf needs an account. Sign up free and start filling it.');
  });

  it('the add button shows the line instead of the button, for a signed-out visitor while accounts are on', () => {
    expect(addButton).toMatch(/const askForAccount = target === 'browser' && accountOn;/);
    expect(addButton).toMatch(/if \(qty === 0 && askForAccount\) \{\s*return <span[^>]*><Link href="\/auth" className="underline">\{VOICE\.guestAddNote\}<\/Link><\/span>;\s*\}/);
  });

  it('nothing is added for a signed-out visitor: add() returns first', () => {
    expect(addButton).toMatch(/const add = \(\) => \{\s*if \(askForAccount \|\| target === 'none'\) return;/);
  });

  it('the hook is called unconditionally (before any branch)', () => {
    expect(addButton.indexOf('const acct = useAccountLists();')).toBeLessThan(addButton.indexOf('const askForAccount'));
    expect(addButton).not.toMatch(/&& useAccountSession\(\)/);
  });
});

describe('the set page supplies the shared session read to the heart and the add button', () => {
  it('the slots are inside the provider, enabled only while accounts are on', () => {
    expect(setPage).toMatch(/<AccountSessionProvider enabled=\{FEATURE_FLAGS\.accountsEnabled\}>[\s\S]*<HeartSlot[\s\S]*<CollectionSlot[\s\S]*<\/AccountSessionProvider>/);
  });
});
