// G1 (public pages stay cached): the set page reads no cookies and no request headers on the server. Its account pieces
// are client-only (order 0290 item 1). Source check; the page is a server component.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const page = readFileSync(join(root, 'src/app/sets/[slug]/page.tsx'), 'utf8');

describe('the set page does not read the session on the server', () => {
  it('does not import the request cookie or header readers', () => {
    expect(page).not.toMatch(/from ['"]next\/headers['"]/);
  });

  it('does not read cookies or headers from the request', () => {
    expect(page).not.toMatch(/\bcookies\s*\(/);
    expect(page).not.toMatch(/\bheaders\s*\(/);
    expect(page).not.toMatch(/\.cookies\.get\(/);
    expect(page).not.toMatch(/request\.headers/);
  });

  it('keeps its cache settings (the page stays cached)', () => {
    expect(page).not.toMatch(/export const dynamic = ['"]force-dynamic['"]/);
  });
});
