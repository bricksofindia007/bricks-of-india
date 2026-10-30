// 2h (order 0290 item 1): hearts, the add button and My Collection use the account when signed in, the browser when
// signed out, and nothing when the session is unknown or unavailable. Source checks (no DOM test setup in this repo).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { saveTarget } from '../src/lib/account-client';

const root = join(__dirname, '..');
const buttons = readFileSync(join(root, 'src/components/saved/SaveButtons.tsx'), 'utf8');
const page = readFileSync(join(root, 'src/app/my/MyCollection.tsx'), 'utf8');
const route = readFileSync(join(root, 'src/app/api/account/lists/route.ts'), 'utf8');
const heart = buttons.slice(buttons.indexOf('export function HeartButton'), buttons.indexOf('/**\n * "Add to my collection"'));
const add = buttons.slice(buttons.indexOf('export function AddToCollectionButton'));

describe('who a save goes to', () => {
  it('signed in: account; signed out: browser; unknown and unavailable: nothing', () => {
    expect(saveTarget('signed-in')).toBe('account');
    expect(saveTarget('signed-out')).toBe('browser');
    expect(saveTarget('unknown')).toBe('none');
    expect(saveTarget('unavailable')).toBe('none');
  });
});

describe('the heart', () => {
  it('reads its target from the shared session, only while accounts are on', () => {
    expect(heart).toMatch(/const accountOn = FEATURE_FLAGS\.accountsEnabled && acct !== null;/);
    expect(heart).toMatch(/const target = accountOn \? saveTarget\(acct\.status\) : 'browser';/);
  });

  it('is not clickable when the target is none', () => {
    expect(heart).toMatch(/disabled=\{target === 'none'\}/);
    expect(heart).toMatch(/if \(target === 'none'\) return;/);
  });

  it('saves to the account, and applies the change locally only after the server says ok', () => {
    expect(heart).toMatch(/accountClient\.remove\('wishlist', set\)/);
    expect(heart).toMatch(/accountClient\.add\('wishlist', set\)/);
    expect(heart).toMatch(/if \(r\.status !== 'ok'\) return;[\s\S]*acct\?\.changeLocal\('wishlist'/);
  });

  it('a limit shows the approved line; any other failure says nothing', () => {
    expect(heart).toMatch(/if \(r\.status === 'limit'\) return setNote\(VOICE\.limitReached\);/);
  });
});

describe('the add button', () => {
  it('shows nothing clickable while the session is unknown or unavailable', () => {
    expect(add).toMatch(/if \(target === 'none'\) return null;/);
  });

  it('a signed-out visitor is asked to sign up and nothing is added', () => {
    expect(add).toMatch(/const askForAccount = target === 'browser' && accountOn;/);
    expect(add).toMatch(/if \(askForAccount \|\| target === 'none'\) return;/);
  });

  it('a signed-in visitor adds to the account collection, applied locally after ok', () => {
    expect(add).toMatch(/accountClient\.add\('collection', set, 1\)/);
    expect(add).toMatch(/if \(r\.status !== 'ok'\) return;\s*acct\?\.changeLocal\('collection', set/);
  });

  it('the copy counter is for the browser list only', () => {
    expect(add).toMatch(/if \(target === 'account'\) \{\s*return <span[^>]*><span className="font-semibold">In My Collection<\/span><\/span>;/);
  });
});

describe('My Collection', () => {
  it('the provider carries the names, and the page uses the account when signed in', () => {
    expect(page).toMatch(/<AccountSessionProvider enabled=\{FEATURE_FLAGS\.accountsEnabled\} withNames>/);
    expect(page).toMatch(/const signedIn = FEATURE_FLAGS\.accountsEnabled && acct\?\.status === 'signed-in';/);
  });

  it('the browser lists are read only while signed out', () => {
    expect(page).toMatch(/useEffect\(\(\) => \{\s*if \(signedIn\) return;/);
  });

  it('the account lists are shown with their names, from the shared read', () => {
    expect(page).toMatch(/setWish\(acct\.lists\.wishlist\.map\(accountWish\)\);/);
    expect(page).toMatch(/setOwned\(acct\.lists\.collection\.map\(accountOwned\)\);/);
  });

  it('removing a wishlist set when signed in goes to the account', () => {
    expect(page).toMatch(/if \(signedIn\) \{\s*void accountClient\.remove\('wishlist', set\)/);
  });

  it('the copy buttons are hidden when signed in (no quantity change on the account yet)', () => {
    expect(page).toMatch(/\{signedIn \? \(\s*<div className="mt-2 text-xs"><span aria-live="polite">\{o\.qty\}<\/span><\/div>/);
  });
});

describe('the lists route', () => {
  it('names are read only when the request asks for them', () => {
    expect(route).toMatch(/names: request\.nextUrl\.searchParams\.get\('names'\) === '1'/);
  });
});
