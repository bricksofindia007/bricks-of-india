// Client side of the account saves (P5, order 0230). Pure mapping of the server's answers, with the fetch injected so the
// tests use a stub. No UI is wired to this module yet: the heart and the lists stay on the browser until the shared
// account cache and the name lookup are decided (see the P5 note in the report).
// Rules: signed-in saves go to the account; signed-out saves go to the browser; unknown or unavailable saves nothing,
// so the page never claims a save it did not make (G14).

export type SessionState = 'unknown' | 'signed-in' | 'signed-out' | 'unavailable';
export type SaveTarget = 'account' | 'browser' | 'none';
export type AccountStatus = 'ok' | 'limit' | 'invalid' | 'signed-out' | 'unavailable';

/** A 404 means the account features are off, so the visitor is treated as a guest. */
export function sessionFromHttp(status: number): SessionState {
  if (status === 200) return 'signed-in';
  if (status === 401 || status === 404) return 'signed-out';
  return 'unavailable';
}

export function saveTarget(state: SessionState): SaveTarget {
  if (state === 'signed-in') return 'account';
  if (state === 'signed-out') return 'browser';
  return 'none';
}

export type Fetcher = (url: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<{ status: number; json: () => Promise<any> }>;

function mapStatus(http: number): AccountStatus {
  if (http === 200) return 'ok';
  if (http === 409) return 'limit';
  if (http === 400) return 'invalid';
  if (http === 401) return 'signed-out';
  return 'unavailable';
}

export function createAccountClient(fetcher: Fetcher) {
  const URL_LISTS = '/api/account/lists';

  async function send(method: 'POST' | 'DELETE', list: string, set: string, qty?: number): Promise<{ status: AccountStatus }> {
    try {
      const res = await fetcher(URL_LISTS, {
        method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(qty === undefined ? { list, set } : { list, set, qty }),
      });
      return { status: mapStatus(res.status) };
    } catch {
      return { status: 'unavailable' };
    }
  }

  return {
    /** Who is signed in. A network failure is "unavailable", never "signed-out". */
    async state(): Promise<SessionState> {
      try {
        const res = await fetcher(URL_LISTS);
        return sessionFromHttp(res.status);
      } catch {
        return 'unavailable';
      }
    },
    add: (list: string, set: string, qty?: number) => send('POST', list, set, qty),
    remove: (list: string, set: string) => send('DELETE', list, set),
  };
}
