/**
 * MRP coverage rule for the Catalogue Health Audit (pure, no I/O).
 *
 * A set's page shows an MRP when the store anchor (set_price_summary.anchor_mrp_inr)
 * is set, or when a verified catalogue MRP exists. GWP gifts are excluded by design.
 *
 * Failure rule: every IN-STOCK listed set must show an MRP. A set with no in-stock
 * listing is not a failure; it is reported as information only, so an out-of-stock
 * set with no verified MRP never fails the audit.
 */

export interface PriceRow {
  set_id: string; // set number, not a UUID (DATA-01)
  in_stock: boolean;
}

export interface SetRow {
  set_number: string;
  name: string;
  lego_mrp_inr: number | null;
  mrp_verified: boolean;
  is_gwp: boolean;
}

export interface MrpCoverageResult {
  inStockCount: number; // in-stock listed sets considered by the rule
  missing: { set_number: string; name: string }[]; // in stock, no MRP shown: failure
  outOfStockNoMrp: { set_number: string; name: string }[]; // informational only
}

export function pageShowsMrp(set: SetRow, anchorMrp: number | null | undefined): boolean {
  return anchorMrp != null || (set.lego_mrp_inr != null && set.mrp_verified);
}

export function mrpCoverage(
  rows: PriceRow[],
  sets: SetRow[],
  anchors: Map<string, number | null>,
): MrpCoverageResult {
  const inStock = new Set(rows.filter((r) => r.in_stock).map((r) => r.set_id));
  const listed = new Set(rows.map((r) => r.set_id));
  const byNumber = new Map(sets.map((s) => [s.set_number, s]));

  const missing: { set_number: string; name: string }[] = [];
  for (const sn of Array.from(inStock)) {
    const s = byNumber.get(sn);
    if (!s) {
      missing.push({ set_number: sn, name: '(not found in sets table)' });
      continue;
    }
    if (s.is_gwp) continue;
    if (!pageShowsMrp(s, anchors.get(sn))) missing.push({ set_number: sn, name: s.name });
  }

  const outOfStockNoMrp: { set_number: string; name: string }[] = [];
  for (const sn of Array.from(listed)) {
    if (inStock.has(sn)) continue;
    const s = byNumber.get(sn);
    if (!s || s.is_gwp) continue;
    if (!pageShowsMrp(s, anchors.get(sn))) outOfStockNoMrp.push({ set_number: sn, name: s.name });
  }

  return { inStockCount: inStock.size, missing, outOfStockNoMrp };
}
