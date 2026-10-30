// P3 wiring (order 0230): the sign-in form joins the browser lists after a successful code check, and before "done".
// Checked in the source (no DOM test setup in this repo).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, '..', 'src/app/auth/SignInForm.tsx'), 'utf8');

describe('sign-in form joins the browser lists', () => {
  it('calls the merge route after the code check succeeds', () => {
    const onCode = src.slice(src.indexOf('async function onCode'));
    expect(onCode).toMatch(/if \(r\.ok\) \{\s*await joinBrowserLists\(\);\s*setStep\('done'\);\s*\}/);
  });

  it('posts the two browser lists to the merge route', () => {
    expect(src).toContain("'/api/account/lists/merge'");
    expect(src).toMatch(/wishlist: loadWishlist\(\), collection: loadCollection\(\)/);
  });

  it('a failed merge is swallowed: no new visitor text is added', () => {
    expect(src).toMatch(/catch \{\s*\/\/ keep the browser lists\s*\}/);
    expect(src).not.toMatch(/Your lists|joined|merged/i);
  });
});
