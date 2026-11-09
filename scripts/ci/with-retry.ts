/**
 * Retries a database read that fails with an error. The review schema check reads the sets table in pages; one page
 * failed once with a server-side "Internal server error" (run 42387186003) and the whole check stopped. A retry lets a
 * transient failure pass; a read that keeps failing still fails the check with its last error.
 */
export interface ReadResult<T> {
  data: T | null;
  error: { message: string } | null;
}

export async function withRetry<T>(
  read: () => PromiseLike<ReadResult<T>>,
  opts: { attempts?: number; delayMs?: number; sleep?: (ms: number) => Promise<void> } = {},
): Promise<ReadResult<T>> {
  const attempts = opts.attempts ?? 3;
  const delayMs = opts.delayMs ?? 2000;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  let last: ReadResult<T> | null = null;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    last = await read();
    if (!last.error) return last;
    if (attempt < attempts) await sleep(delayMs * attempt);
  }
  return last as ReadResult<T>;
}
