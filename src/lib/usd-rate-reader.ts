import type { RateSource, StoredRate } from './collection-worth';

// Client-safe: the pure conversion and the rate source. The server read lives in usd-rate-server.ts.
// Never fetches a rate from outside.

type RateRow = { rate: number | string; value_date: string };

/** Pure: one function row to the stored-rate shape the worth code uses. Null when the row is not usable. */
export function toStoredRate(row: RateRow | null | undefined): StoredRate | null {
  if (!row) return null;
  const rate = Number(row.rate);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  if (typeof row.value_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.value_date)) return null;
  return { rate, asOf: row.value_date };
}

/** A rate source over an already-loaded value (what the page passes to the worth code). */
export function rateSourceOf(stored: StoredRate | null): RateSource {
  return { getRate: () => stored };
}
