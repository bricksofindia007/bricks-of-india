// Staging read-only guard. Used only by the staging Worker (STAGING_READONLY="1").
// Pure functions: the Worker entry (worker/staging-entry.ts) calls them.
//
// While the flag is on:
// - every request that is not GET or HEAD gets 405, including form posts and
//   server actions (contact, newsletter, admin). A server action is a POST, so
//   it is covered by the same rule.
// - every response carries a noindex header, and /robots.txt disallows everything.

export const READONLY_FLAG = 'STAGING_READONLY';

export function isReadonly(env: Record<string, unknown> | undefined): boolean {
  return env?.[READONLY_FLAG] === '1';
}

const ROBOTS_ALL_DISALLOWED = 'User-agent: *\nDisallow: /\n';

/** Returns the response to send instead of passing the request on, or null to pass it on. */
export function readonlyGate(method: string, pathname: string): Response | null {
  if (pathname === '/robots.txt') {
    return new Response(ROBOTS_ALL_DISALLOWED, {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex, nofollow' },
    });
  }
  if (method === 'GET' || method === 'HEAD') return null;
  return new Response('Read-only staging: writes are disabled.', {
    status: 405,
    headers: { allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8', 'x-robots-tag': 'noindex, nofollow' },
  });
}

/** Adds noindex to any response. */
export function withNoindex(res: Response): Response {
  const headers = new Headers(res.headers);
  headers.set('x-robots-tag', 'noindex, nofollow');
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}
