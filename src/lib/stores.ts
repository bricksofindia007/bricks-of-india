// Retailer registry read (FP5.1 part 2, 27 Sep 2026). G4: retailers are
// data -- every page that names, orders or links a store gets it from
// public.stores (display_enabled rows, display_order), not from a
// hand-written map. Replaces 9 copies (TRACKED_STORES x2, STORE_NAMES,
// STORE_LABELS x6, which-set STORES).
//
// Cost (G2): one tiny PostgREST read, cached in the Next data cache for
// READ_REVALIDATE_SECONDS and shared by every route that calls it (same URL,
// same cache key), plus React cache() dedupe within a render.
//
// Failure (G14): a read error returns [] -- pages then show no store rows or
// labels fall back to the raw store id. Never a stale hardcoded list.

import { cache } from 'react';
import { createServerClient } from './supabase';
import { READ_REVALIDATE_SECONDS } from './price-freshness';

export type Store = {
  id: string;
  name: string;
  site_url: string;
  display_order: number;
  affiliate_note: string | null;
  price_precision: number;
};

export const getStores = cache(async (): Promise<Store[]> => {
  const sb = createServerClient({ revalidate: READ_REVALIDATE_SECONDS });
  const { data, error } = await sb
    .from('stores')
    .select('id, name, site_url, display_order, affiliate_note, price_precision')
    .eq('display_enabled', true)
    .order('display_order', { ascending: true });
  if (error) {
    console.error('[stores] registry read failed:', error.message);
    return [];
  }
  return (data ?? []) as Store[];
});

/** id -> display name, for labelling rows that carry a store_id. */
export function storeLabels(stores: Store[]): Record<string, string> {
  return Object.fromEntries(stores.map((s) => [s.id, s.name]));
}

/** Label for a store id; unknown ids show as-is (never a guessed name). */
export function storeLabel(labels: Record<string, string>, id: string): string {
  return labels[id] ?? id;
}
