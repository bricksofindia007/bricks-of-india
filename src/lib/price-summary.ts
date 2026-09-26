// Locked pricing rules R2-R6 on the page side (PR-B, 2026-09-26). The numbers
// come from the public.set_price_summary view (migration 20260926020000) so
// /deals, /, set pages, cards and /lab/deals can never disagree.
import type { SupabaseClient } from '@supabase/supabase-js';

export const STORE_NAMES: Record<string, string> = {
  mybrickhouse: 'MyBrickHouse',
  toycra: 'Toycra',
};
export const storeName = (id: string) => STORE_NAMES[id] ?? id;

export const ANCHOR_SOURCE_LABEL: Record<string, string> = {
  mybrickhouse: 'as listed by MyBrickHouse',
  toycra: 'as listed by Toycra',
  catalogue: 'verified LEGO India MRP',
};

export type DealTier = 'hot' | 'deal';

export type SetPriceSummary = {
  set_id: string;
  anchor_mrp_inr: number | null;
  anchor_source: 'mybrickhouse' | 'toycra' | 'catalogue' | null;
  best_price_inr: number | null;      // cheapest in-stock price scraped within 12h
  best_store_ids: string[] | null;    // every store at that price, alphabetical (R5)
  best_scraped_at: string | null;
  in_stock_store_count: number;       // stores fresh + in stock
  discount_pct: number | null;
  deal_tier: DealTier | null;
};

const COLS = 'set_id, anchor_mrp_inr, anchor_source, best_price_inr, best_store_ids, best_scraped_at, in_stock_store_count, discount_pct, deal_tier';

function normalise(r: any): SetPriceSummary {
  return {
    ...r,
    anchor_mrp_inr: r.anchor_mrp_inr == null ? null : Number(r.anchor_mrp_inr),
    best_price_inr: r.best_price_inr == null ? null : Number(r.best_price_inr),
    discount_pct: r.discount_pct == null ? null : Number(r.discount_pct),
  };
}

/** Summaries for the given sets, keyed by set number. Chunked to keep URLs short. */
export async function getPriceSummaries(sb: SupabaseClient, setIds: string[]): Promise<Map<string, SetPriceSummary>> {
  const out = new Map<string, SetPriceSummary>();
  const ids = [...new Set(setIds)];
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await sb.from('set_price_summary').select(COLS).in('set_id', ids.slice(i, i + 150));
    // Cards degrade to "no badge" rather than failing the page; /deals
    // (getDeals) throws instead, since without the view it has nothing to show.
    if (error) { console.error('[price-summary] set_price_summary read failed:', error.message); return out; }
    for (const r of data ?? []) out.set(r.set_id, normalise(r));
  }
  return out;
}

/** Every current deal (R3), biggest discount first. Paginated past PostgREST's 1,000-row cap. */
export async function getDeals(sb: SupabaseClient): Promise<SetPriceSummary[]> {
  const out: SetPriceSummary[] = [];
  for (let off = 0; ; off += 1000) {
    const { data, error } = await sb.from('set_price_summary').select(COLS)
      .not('deal_tier', 'is', null)
      .order('discount_pct', { ascending: false })
      .order('set_id', { ascending: true })
      .range(off, off + 999);
    if (error) throw error;
    out.push(...(data ?? []).map(normalise));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/**
 * What the price label beside the best price says (R5/R6):
 *  - 'best'  -- 2+ stores in stock and exactly one is cheapest: "Best Price" badge
 *  - 'tie'   -- 2+ stores share the lowest price: shown together, no badge/trophy
 *  - 'only'  -- exactly one store in stock: "Only at <store>"
 *  - null    -- no fresh in-stock price
 */
export type PriceLabel = { kind: 'best' | 'tie' | 'only'; stores: string[] } | null;

export function priceLabel(s: SetPriceSummary | null | undefined): PriceLabel {
  if (!s || s.best_price_inr == null || !s.best_store_ids?.length) return null;
  if (s.in_stock_store_count <= 1) return { kind: 'only', stores: s.best_store_ids };
  if (s.best_store_ids.length > 1) return { kind: 'tie', stores: s.best_store_ids };
  return { kind: 'best', stores: s.best_store_ids };
}
