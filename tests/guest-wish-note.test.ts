// Guests on the wishlist tab see the approved line (D-2026-10-29-05, line 2), only while accounts are on and the visitor
// is signed out. With accounts off nothing changes. Source checks (no DOM test setup in this repo).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { VOICE } from '../src/lib/my-collection';

const root = join(__dirname, '..');
const page = readFileSync(join(root, 'src/app/my/MyCollection.tsx'), 'utf8');

describe('the guest wishlist line', () => {
  it('is the approved text, exactly', () => {
    expect(VOICE.guestWishlistNote).toBe('Saved on this device. Sign up and your wishlist goes where you go.');
  });

  it('shows on the wishlist tab only for a signed-out visitor, and only while accounts are on', () => {
    expect(page).toMatch(/\{ready && tab === 'wish' && FEATURE_FLAGS\.accountsEnabled && session === 'signed-out' && \(\s*<p[^>]*><Link href="\/auth" className="underline">\{VOICE\.guestWishlistNote\}<\/Link><\/p>\s*\)\}/);
  });
});

describe('the page reads the session once, through the shared provider', () => {
  it('the exported page wraps its view in the provider, enabled only while accounts are on', () => {
    expect(page).toMatch(/<AccountSessionProvider enabled=\{FEATURE_FLAGS\.accountsEnabled\} withNames>\s*<MyCollectionView \/>\s*<\/AccountSessionProvider>/);
  });

  it('the view reads the session status', () => {
    expect(page).toContain('const session = useAccountSession();');
  });
});
