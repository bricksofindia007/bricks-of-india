// FP5.3 circuit breaker (P4 Step 4b, 27 Sep 2026).
//
// Before a retailer's run writes anything:
//   trip if parsed listings < 80% of the previous run's, or
//        if > 25% of comparable listings changed price OR stock state.
// A trip -> write NOTHING for that retailer, alert, and record the trip on
// its stores row. The 2nd CONSECUTIVE trip sets display_enabled = false in
// the SAME atomic UPDATE (so the count and the switch can never disagree).
// A clean run resets breaker_trips to 0 (display is NOT auto-re-enabled;
// that's a human decision per the runbook).
//
// Revalidation: pages read set_price_summary, which filters on
// stores.display_enabled, so a disabled store drops out at each route's next
// ISR refresh (<= 1h; set pages <= 6h). A TARGETED revalidate needs the
// FP1.6 / FP2.4 publisher hook, which doesn't exist yet -- flagged in the PR.

export const MIN_PARSED_RATIO = 0.8;
export const MAX_CHANGED_RATIO = 0.25;

/**
 * prev / curr: Map<setNumber, {priceInr, inStock}> (the previous run = today's store_prices for the store).
 * Returns { trip, reasons[], parsedRatio, changedRatio, compared }.
 */
export function evaluateBreaker(prev, curr) {
  const reasons = [];
  const parsedRatio = prev.size === 0 ? 1 : curr.size / prev.size;
  if (prev.size > 0 && parsedRatio < MIN_PARSED_RATIO) reasons.push(`parsed ${curr.size} < 80% of previous ${prev.size}`);
  let compared = 0, changed = 0;
  for (const [k, c] of curr) {
    const p = prev.get(k);
    if (!p) continue;
    compared++;
    if (p.priceInr !== c.priceInr || p.inStock !== c.inStock) changed++;
  }
  const changedRatio = compared === 0 ? 0 : changed / compared;
  if (changedRatio > MAX_CHANGED_RATIO) reasons.push(`${changed}/${compared} (${(changedRatio * 100).toFixed(1)}%) changed price or stock > 25%`);
  return { trip: reasons.length > 0, reasons, parsedRatio, changedRatio, compared, changed };
}

/** SQL for the atomic trip record (run via the service-role RPC or psql). */
export const RECORD_TRIP_SQL = `
UPDATE public.stores
   SET breaker_trips        = breaker_trips + 1,
       last_breaker_trip_at = now(),
       display_enabled      = CASE WHEN breaker_trips + 1 >= 2 THEN false ELSE display_enabled END,
       disabled_reason      = CASE WHEN breaker_trips + 1 >= 2 THEN $2 ELSE disabled_reason END
 WHERE id = $1
RETURNING breaker_trips, display_enabled`;

/**
 * Record a trip via a supabase-js client with the stores_record_breaker_trip
 * RPC (added by the FP5.5 migration) -- one statement, atomic.
 */
export async function recordTrip(sb, storeId, reason) {
  const { data, error } = await sb.rpc('stores_record_breaker_trip', { p_store: storeId, p_reason: reason });
  if (error) throw error;
  return data; // { breaker_trips, display_enabled }
}
export async function recordCleanRun(sb, storeId) {
  const { error } = await sb.from('stores').update({ breaker_trips: 0 }).eq('id', storeId).gt('breaker_trips', 0);
  if (error) throw error;
}
