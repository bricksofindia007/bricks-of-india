import { createServerClient } from './supabase';
import { toStoredRate } from './usd-rate-reader';
import type { StoredRate } from './collection-worth';

// Server only. Reads the one stored USD to INR rate through the price function, with the service-role server
// client (the function is granted to service_role only, migration 20261022180000). Kept out of usd-rate-reader.ts
// so that the client bundle never imports the server client.
// The table itself is closed to browser roles. Returns null when there is no usable row, so the caller shows no estimate.

/** The stored rate, or null. Errors and empty results both return null: no estimate is shown. */
export async function loadStoredRate(): Promise<StoredRate | null> {
  const { data, error } = await createServerClient().rpc('get_usd_inr_rate');
  if (error || !Array.isArray(data) || data.length === 0) return null;
  return toStoredRate(data[0] as { rate: number | string; value_date: string });
}
