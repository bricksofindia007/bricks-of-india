// Guests on the My Collection tab see the approved line (D-2026-10-29-05, line 4), only while accounts are on and the
// visitor is signed out. Source checks (no DOM test setup in this repo).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VOICE } from '../src/lib/my-collection';

const root = join(__dirname, '..');
const page = readFileSync(join(root, 'src/app/my/MyCollection.tsx'), 'utf8');

describe('the guest collection line', () => {
  it('is the approved text, exactly', () => {
    expect(VOICE.guestCollectionNote).toBe('Own it? Prove it. Sign up and start your shelf.');
  });

  it('shows on the collection tab only for a signed-out visitor, and only while accounts are on', () => {
    expect(page).toMatch(/\{ready && tab === 'owned' && FEATURE_FLAGS\.accountsEnabled && session === 'signed-out' && \(\s*<p[^>]*><Link href="\/auth" className="underline">\{VOICE\.guestCollectionNote\}<\/Link><\/p>\s*\)\}/);
  });

  it('the wishlist line is still there, unchanged', () => {
    expect(page).toMatch(/\{VOICE\.guestWishlistNote\}/);
  });
});
