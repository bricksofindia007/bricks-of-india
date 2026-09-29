// Gate 14 step 1b (#398, P5 Step 1 / P8): catalogue facts for NEW review drafts.
//
//   resolveGate14Facts()  pieces: sets.pieces -> Rebrickable num_parts -> Brickset
//                         minifigs: sets.minifigs -> Brickset
//                         prices: every store_prices row (current); MRP: anchor + catalogue
//   catalogueFactsPrompt() the same facts injected into the review prompt, so the
//                         model is told the numbers Gate 14 will check against
//   gate14Feedback()      REVISION REQUIRED text for the shared Gates 11-14 regeneration
//   writeBackPieces()     a looked-up count is written to a sets row whose pieces is
//                         0/NULL (never overwrites a real count), with sets.pieces_source
//
// Failure behaviour (G14): a failed lookup leaves that fact unknown. Gate 14
// then reports any claim about it as UNVERIFIABLE, and an unverifiable-only
// result is held for review, never published. Nothing here can publish a
// wrong figure. The write-back is best effort: if the pieces_source column
// isn't there yet (migration 20260928110000 is applied through the db-migrate
// job), it's skipped and logged, and the count is not written.
//
// Budget (G2): per review draft, 3 Supabase reads (sets, store_prices,
// set_price_summary), plus at most 1 Rebrickable call and 1 Brickset getSets
// call, only when the catalogue lacks the fact, plus at most 1 sets update.
// Reviews are about 1 per day.

import type { Gate14Facts, Gate14Finding } from './gate14';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sb = { from: (t: string) => any };
type Fetch = (url: string, init?: { headers?: Record<string, string>; signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<any> }>;

export type FactSource = 'sets' | 'rebrickable' | 'brickset' | null;
export type ResolvedGate14Facts = { facts: Gate14Facts; piecesSource: FactSource; minifigsSource: FactSource; catalogueHadPieces: boolean };

export async function resolveGate14Facts(
  sb: Sb,
  setNumber: string,
  opts: { fetch?: Fetch; rebrickableKey?: string | null; bricksetKey?: string | null } = {},
): Promise<ResolvedGate14Facts | null> {
  const f = opts.fetch ?? (fetch as unknown as Fetch);
  const { data: set, error } = await sb.from('sets')
    .select('set_number, name, pieces, minifigs, year, lego_mrp_inr, is_gwp')
    .eq('set_number', setNumber).maybeSingle();
  if (error || !set) return null;

  const [{ data: sp }, { data: summ }] = await Promise.all([
    sb.from('store_prices').select('price_inr').eq('set_id', setNumber),
    sb.from('set_price_summary').select('anchor_mrp_inr').eq('set_id', setNumber).maybeSingle(),
  ]);

  let pieces: number | null = Number(set.pieces) > 0 ? Number(set.pieces) : null;
  let piecesSource: FactSource = pieces ? 'sets' : null;
  let minifigs: number | null = set.minifigs != null ? Number(set.minifigs) : null;
  let minifigsSource: FactSource = minifigs != null ? 'sets' : null;

  if (!pieces && opts.rebrickableKey) {
    try {
      const r = await f(`https://rebrickable.com/api/v3/lego/sets/${setNumber}-1/`, { headers: { Authorization: `key ${opts.rebrickableKey}` }, signal: AbortSignal.timeout(8000) });
      const n = r.ok ? Number((await r.json()).num_parts) : 0;
      if (n > 0) { pieces = n; piecesSource = 'rebrickable'; }
    } catch (e) { console.warn(`[gate14] Rebrickable lookup failed for ${setNumber}: ${(e as Error).message}`); }
  }
  // One Brickset call per review draft (when a key is set): pieces/minifigs if the catalogue
  // lacks them, and (P10 item 4) availability + LEGO.com retail prices for the GWP rule.
  let bricksetGwp = false, legoComPrice: boolean | null = null;
  if (opts.bricksetKey) {
    try {
      const params = JSON.stringify({ setNumber: `${setNumber}-1`, pageSize: 1 });
      const url = `https://brickset.com/api/v3.asmx/getSets?apiKey=${encodeURIComponent(opts.bricksetKey)}&userHash=&params=${encodeURIComponent(params)}`;
      const r = await f(url, { signal: AbortSignal.timeout(8000) });
      const j = r.ok ? await r.json() : null;
      const b = j?.status === 'success' ? j.sets?.[0] : null;
      if (b && !pieces && Number(b.pieces) > 0) { pieces = Number(b.pieces); piecesSource = 'brickset'; }
      if (b && minifigs == null && b.minifigs != null) { minifigs = Number(b.minifigs); minifigsSource = 'brickset'; }
      if (b) {
        bricksetGwp = b.availability === 'LEGO Gift with Purchase';
        legoComPrice = Object.values((b.LEGOCom ?? {}) as Record<string, { retailPrice?: number }>).some((x) => Number(x?.retailPrice) > 0);
      }
    } catch (e) { console.warn(`[gate14] Brickset lookup failed for ${setNumber}: ${(e as Error).message}`); }
  }

  const prices = ((sp ?? []) as { price_inr: number | null }[]).map((r) => Number(r.price_inr)).filter((x) => x > 0);
  const mrp = [summ?.anchor_mrp_inr, set.lego_mrp_inr].map(Number).filter((x) => x > 0);
  // P10 item 4: GWP by the catalogue flag or Brickset, or no retail price anywhere. "Anywhere"
  // needs Brickset's answer: if Brickset couldn't be read (legoComPrice null), that arm isn't used.
  const noRetailPrice = !prices.length && !mrp.length && legoComPrice === false;
  // A real Indian listing always wins (the sets.is_gwp contract): a GWP a store sells on its
  // own has a price, and Gate 14's price rules apply to it instead.
  return {
    facts: {
      setNumber, name: set.name, pieces, minifigs, year: set.year ?? null, prices, mrp, verdict: null,
      promotional: !prices.length && (set.is_gwp === true || bricksetGwp || noRetailPrice),
    },
    piecesSource, minifigsSource, catalogueHadPieces: Number(set.pieces) > 0,
  };
}

const inr = (n: number) => {
  const s = Math.round(n).toString(); const last3 = s.slice(-3); const rest = s.slice(0, -3);
  return rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
};

/** Prompt block: the facts Gate 14 will check, and the rules it enforces. */
export function catalogueFactsPrompt(f: Gate14Facts): string {
  const lines = [
    `CATALOGUE FACTS for ${f.setNumber} "${f.name}" -- the ONLY figures you may state about this set:`,
    `  pieces: ${f.pieces ?? 'UNKNOWN -- do not state a piece count'}`,
    `  minifigures: ${f.minifigs ?? 'UNKNOWN -- do not state a minifigure count'}`,
    `  release year: ${f.year ?? 'UNKNOWN -- do not state a release year'}`,
    `  India prices (₹): ${f.prices.length ? [...new Set(f.prices)].map(inr).join(', ') : 'none listed'}`,
    `  MRP (₹): ${f.mrp.length ? [...new Set(f.mrp)].map(inr).join(', ') : 'none'}`,
    'RULES: every ₹ figure must be one of the prices/MRP above or derived from one (12% off, per-piece, difference from MRP). '
      + 'No $, £, € or "estimated import" figure unless you name its source (LEGO.com, Brickset) in the same sentence. '
      + 'Exactly one verdict line. Write in our own voice; never narrate another reviewer or "the article".',
  ];
  if (f.promotional) {
    lines.push(`GIFT WITH PURCHASE / NO RETAIL PRICE: ${f.setNumber} is not sold separately. State NO price, import price or ₹/$ estimate `
      + 'for it. Say it is not sold separately and what it comes with; a spend threshold is a requirement to get it, never its price.');
  }
  return lines.join('\n');
}

export function gate14Feedback(findings: Gate14Finding[]): string {
  const items = findings.slice(0, 8).map((x) => `[${x.rule}] ${x.detail}${x.sentence ? ` in: "${x.sentence.slice(0, 140)}"` : ''}`);
  return `Gate 14 (fact check) failed. Fix exactly these, using only the CATALOGUE FACTS above; if a fact is UNKNOWN, remove the claim: ${items.join('; ')}.`;
}

/** Every finding is about a fact we could not resolve (not a contradicted fact). */
export function isUnverifiableOnly(findings: Gate14Finding[]): boolean {
  return findings.length > 0 && findings.every((x) => /unverifiable/.test(x.detail));
}

export type WriteBackResult = 'written' | 'not-needed' | 'no-column' | 'error';

/** Writes a looked-up piece count to a sets row whose pieces is 0/NULL. Never overwrites a real count. */
export async function writeBackPieces(sb: Sb, r: ResolvedGate14Facts, now = new Date()): Promise<WriteBackResult> {
  if (r.catalogueHadPieces || !r.facts.pieces || (r.piecesSource !== 'rebrickable' && r.piecesSource !== 'brickset')) return 'not-needed';
  const label = r.piecesSource === 'rebrickable' ? 'Rebrickable' : 'Brickset';
  const { error } = await sb.from('sets')
    .update({
      pieces: r.facts.pieces,
      pieces_source: `${label} (Gate 14 write-back, ${now.toISOString().slice(0, 10)})`,
      pieces_source_checked_at: now.toISOString(),
    })
    .eq('set_number', r.facts.setNumber)
    .or('pieces.is.null,pieces.eq.0');
  if (!error) return 'written';
  if (error.code === '42703' || error.code === 'PGRST204' || /pieces_source/.test(error.message ?? '')) {
    console.warn(`[gate14] write-back skipped for ${r.facts.setNumber}: sets.pieces_source not in this database yet (migration 20260928110000)`);
    return 'no-column';
  }
  console.error(`[gate14] write-back failed for ${r.facts.setNumber}: ${error.message}`);
  return 'error';
}
