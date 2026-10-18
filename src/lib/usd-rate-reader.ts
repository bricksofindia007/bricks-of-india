import { createPublicClient } from './supabase';
import type { RateSource, StoredRate } from './collection-worth';

// Reads the one stored USD to INR rate through the granted read function (public key, read-only).
// The table itself is closed to browser roles; only the function is granted. Returns null when there is no
// usable row, so the caller shows no estimate. Never fetches a rate from outside.

type RateRow = { rate: number | string; value_date: string };

/** Pure: one function row to the stored-rate shape the worth code uses. Null when the row is not usable. */
export function toStoredRate(row: RateRow | null | undefined): StoredRate | null {
  if (!row) return null;
  const rate = Number(row.rate);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  if (typeof row.value_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row.value_date)) return null;
  return { rate, asOf: row.value_date };
}

/** The stored rate, or null. Errors and empty results both return null: no estimate is shown. */
export async function loadStoredRate(): Promise<StoredRate | null> {
  const { data, error } = await createPublicClient().rpc('get_usd_inr_rate');
  if (error || !Array.isArray(data) || data.length === 0) return null;
  return toStoredRate(data[0] as RateRow);
}

/** A rate source over an already-loaded value (what the page passes to the worth code). */
export function rateSourceOf(stored: StoredRate | null): RateSource {
  return { getRate: () => stored };
}
