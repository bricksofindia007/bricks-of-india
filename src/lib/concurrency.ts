// Order 1953 item 4b. Runs async work over a list with a fixed number of requests in flight at once.
// Results keep the input order. The first error rejects the whole call (no partial result is returned).

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const width = Math.max(1, Math.min(Math.floor(limit), items.length));
  const workers = Array.from({ length: width }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}
