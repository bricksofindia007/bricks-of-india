// Order 1953 item 4b. The default /sets order: every set, newest first, read in parallel pages instead of one page after
// another (27 pages in series before). The count is read first, so the page offsets are known. The order is the same as
// before: year descending, then set number descending (both unique together, so the result is deterministic).
import type { SupabaseClient } from '@supabase/supabase-js';
import { mapWithConcurrency } from './concurrency';

export type SetOrderRow = { set_number: string; year: number | null; theme: string | null };

export const SETS_ORDER_PAGE_SIZE = 1000;
export const SETS_ORDER_CONCURRENCY = 6;

/** Every set in the default order. Throws on a read error (a partial order is never returned or cached). */
export async function loadAllSetsOrder(
  sb: Pick<SupabaseClient, 'from'>,
  pageSize = SETS_ORDER_PAGE_SIZE,
  concurrency = SETS_ORDER_CONCURRENCY,
): Promise<SetOrderRow[]> {
  const head = await sb.from('sets').select('set_number', { count: 'exact', head: true });
  if (head.error) throw head.error;
  const total = head.count ?? 0;
  const offsets: number[] = [];
  for (let offset = 0; offset < total; offset += pageSize) offsets.push(offset);
  const pages = await mapWithConcurrency(offsets, concurrency, async (offset) => {
    const { data, error } = await sb
      .from('sets')
      .select('set_number, year, theme')
      .order('year', { ascending: false })
      .order('set_number', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    return (data ?? []) as SetOrderRow[];
  });
  return pages.flat();
}
