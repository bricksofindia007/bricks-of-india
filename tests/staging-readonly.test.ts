import { describe, expect, it } from 'vitest';
import { isReadonly, readonlyGate, withNoindex } from '@/lib/staging-readonly';

describe('staging read-only: blocked writes (405 on every route)', () => {
  it('blocks a contact form post', () => {
    const r = readonlyGate('POST', '/contact');
    expect(r?.status).toBe(405);
  });

  it('blocks the newsletter sign-up (a server action posted to the home page)', () => {
    // A server action is a POST; the newsletter form posts to the page it is on.
    const r = readonlyGate('POST', '/');
    expect(r?.status).toBe(405);
  });

  it('blocks admin pages that accept a post (review queue)', () => {
    expect(readonlyGate('POST', '/admin/pending')?.status).toBe(405);
  });

  it('blocks admin server actions (posted to the admin newsletter page)', () => {
    expect(readonlyGate('POST', '/admin/pending/newsletter')?.status).toBe(405);
  });

  it('blocks PUT, PATCH and DELETE on any API route', () => {
    expect(readonlyGate('PUT', '/api/sets/search')?.status).toBe(405);
    expect(readonlyGate('PATCH', '/api/sets/search')?.status).toBe(405);
    expect(readonlyGate('DELETE', '/api/sets/search')?.status).toBe(405);
  });

  it('says which methods are allowed', () => {
    const r = readonlyGate('POST', '/contact');
    expect(r?.headers.get('allow')).toBe('GET, HEAD');
  });

  it('adds noindex to the 405 response', () => {
    const r = readonlyGate('POST', '/contact');
    expect(r?.headers.get('x-robots-tag')).toContain('noindex');
  });
});

describe('staging read-only: reads still pass through', () => {
  it('lets GET and HEAD through to the site', () => {
    expect(readonlyGate('GET', '/compare')).toBeNull();
    expect(readonlyGate('HEAD', '/news')).toBeNull();
  });
});

describe('staging read-only: robots file', () => {
  it('serves a robots file that disallows everything', async () => {
    const r = readonlyGate('GET', '/robots.txt');
    expect(r?.status).toBe(200);
    expect(await r?.text()).toBe('User-agent: *\nDisallow: /\n');
    expect(r?.headers.get('x-robots-tag')).toContain('noindex');
  });

  it('serves the same file for HEAD', () => {
    expect(readonlyGate('HEAD', '/robots.txt')?.status).toBe(200);
  });
});

describe('staging read-only: noindex on every response', () => {
  it('adds the noindex header to a page', () => {
    const page = new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } });
    const out = withNoindex(page);
    expect(out.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(out.headers.get('content-type')).toBe('text/html');
    expect(out.status).toBe(200);
  });
});

describe('staging read-only: the flag', () => {
  it('is on only when STAGING_READONLY is "1"', () => {
    expect(isReadonly({ STAGING_READONLY: '1' })).toBe(true);
    expect(isReadonly({ STAGING_READONLY: '0' })).toBe(false);
    expect(isReadonly({})).toBe(false);
    expect(isReadonly(undefined)).toBe(false);
  });
});
