// Gate 14: pre-publish fact check for reviews (P4 Step 5; #246, #388, #390).
// Pure and deterministic: every check runs against catalogue FACTS supplied
// by the caller, which resolves them in this order (P4): sets.pieces ->
// Rebrickable num_parts -> Brickset (one batched, cached call). A claim
// whose fact is unknown is UNVERIFIABLE and FAILS (fail closed, G14).
// The LLM coherence judge (scripts/video/coherence_judge.py contract) is a
// separate step because it needs the Groq key.
//
// Rules
//   pieces     "<n> pieces / <n>-piece": within the #247 audit's tolerances
//   minifigs   "<n> minifigures": exact
//   year       "released/launched ... <year>": equals sets.year
//   inr        every ₹ figure is a current displayed price for the set (any
//              store row), the anchor/catalogue MRP, ₹500 (ABHINAV12 minimum),
//              a price x 0.88 (ABHINAV12 12% off), or a per-piece value derived
//              from one of those -- otherwise it must be removed
//   foreign    $/USD/£/€ prices, and "import/estimated" ₹ prices, need a named
//              source in the same sentence (LEGO.com, Brickset, ...)
//   verdict    exactly one verdict line, equal to reviews.verdict
//   leak       narrated source ("the reviewer", "the source", "according to
//              the article", "they also note") is not our editorial voice
//   gwp        (P10 item 4) a gift-with-purchase set, or one with no retail
//              price anywhere, gets NO price claim: any sentence with a ₹/$/£/€
//              figure must say it's not sold separately, or be a plain spend-
//              threshold statement ("free with orders over US$100"). An
//              "import price" or "estimated" figure is never allowed for it.

export type Gate14Facts = {
  setNumber: string;
  name: string;
  pieces: number | null;       // null/0 = unknown
  minifigs: number | null;     // null = unknown
  year: number | null;
  prices: number[];            // every displayed store price for the set (in stock or not)
  mrp: number[];               // anchor MRP and/or catalogue MRP
  verdict: string | null;      // reviews.verdict
  // ABHINAV12 (2 Oct 2026): the code only applies to full-price Toycra listings. When set,
  // a code price or code saving is accepted only against these; undefined = legacy behaviour.
  codeBases?: number[];
  otherSetNumbers?: Set<string>;
  // P10 item 4: sets.is_gwp, Brickset availability "LEGO Gift with Purchase",
  // or no retail price anywhere (no store row, no MRP, no LEGO.com price).
  promotional?: boolean;
};
export type Gate14Finding = { rule: 'pieces' | 'minifigs' | 'year' | 'inr' | 'foreign' | 'verdict' | 'leak' | 'gwp'; detail: string; sentence: string };

const sentences = (t: string) => t.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
const num = (s: string) => Number(s.replace(/,/g, ''));
const COMPARISON = /\b(other|compared|than|similar|versus|vs\.?|typical|average|most)\b/i;
const NEGATED = /\b(isn['’]t|is not|not a|not the|that['’]s not)\b[^.]{0,20}$/i;
const PIECES_RE = /(?<![₹\d.,])(?:(just over|over|more than|nearly|almost|around|about|roughly|approximately|some|under|fewer than)\s+)?(\d{1,3}(?:,\d{3})+|\d{2,5})\s*(?:[-‑–]\s*)?(pieces?|pcs|elements)\b/gi;
const WORDNUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const MINIFIG_RE = /\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(?:exclusive\s+|new\s+|unique\s+)?minifig(?:ure)?s?\b/gi;
const RELEASE_RE = /\b(released|launch(?:ed|es|ing)?|arriv(?:ed|es|ing)|debut(?:ed|s)?|hit shelves|came out|out in)\b/i;
const INR_RE = /₹\s?(\d{1,3}(?:,\d{2,3})+(?:\.\d+)?|\d+(?:\.\d+)?)/g;
const FOREIGN_RE = /(?:US\$|\$|USD\s?|£|€|EUR\s?|GBP\s?)\s?\d/;
const NAMED_SOURCE = /\b(LEGO\.com|LEGO Shop|shop\.lego\.com|Brickset|Rebrickable|LEGO's (?:own )?(?:site|store)|official LEGO)\b/i;
// "the source material" = the film/show/game the set is based on (fine); only
// narration of ANOTHER review/article is a leak.
const LEAK_RE = /\b(the reviewer|according to the (?:article|source|review)|the (?:original )?article (?:says|notes|mentions)|they also note|the author notes)\b/i;
// Hypothetical price talk ("if it were closer to ₹3,000 it would be...") states no current price.
const HYPOTHETICAL = /\b(if (?:it|this|the price) (?:were|was|dropped|came down)|closer to|would be (?:an )?(?:easier|no-brainer)|should (?:cost|be priced)|wish (?:it|this) (?:was|were))\b/i;
// Capacity, not contents: "space for two minifigures", "seats four minifigures".
const CAPACITY = /\b(space for|room for|seats?|fits?|holds?|carry|accommodat\w*)\s+(?:up to\s+)?$/i;
const VERDICTS = ['BUY NOW', 'WAIT', 'IMPORT ONLY', 'AVOID'];

function inrAllowed(v: number, f: Gate14Facts): boolean {
  const bases = [...f.prices, ...f.mrp].filter((x) => x > 0);
  if (Math.abs(v - 500) < 1) return true;
  for (const b of bases) {
    if (Math.abs(v - b) <= 1) return true;                                   // displayed price / MRP
    if (f.pieces && f.pieces > 0 && Math.abs(v - b / f.pieces) <= 0.6) return true; // per piece
  }
  for (const b of (f.codeBases ?? bases).filter((x) => x >= 500)) {
    if (Math.abs(v - Math.round(b * 0.88)) <= 2) return true;                // ABHINAV12 12% off
    if (Math.abs(v - (b - Math.round(b * 0.12))) <= 2) return true;
    if (Math.abs(v - Math.round(b * 0.12)) <= 2) return true;                // the saving itself
  }
  const mrps = f.mrp.filter((x) => x > 0);
  for (const m of mrps) for (const p of f.prices) if (Math.abs(v - Math.abs(m - p)) <= 2) return true; // "₹X below/above MRP"
  return false;
}

// P10 item 4: price claims about a gift-with-purchase set.
const MONEY_RE = /(?:₹|US\$|\$|£|€|USD\s?|GBP\s?|EUR\s?)\s?\d/;
const NOT_SOLD = /not (?:sold|available) separately|isn['’]t sold separately|no retail price/i;
const THRESHOLD = /\b(threshold|spend\w*|qualifying|minimum|requirement|free with|orders? (?:of|over|above|totall?ing|exceeding)|purchases? (?:of|over|above|totall?ing|exceeding))\b/i;
const PRICE_WORDS = /\b(import(?:ed)? price|estimated (?:import )?(?:price|cost)|retail price|priced at|price tag|costs?|price of|worth|mrp|when imported)\b/i;
const SET_NO = /\b\d{4,7}\b/g;
/**
 * Sentences that state a price for a GWP set. With setNumber: only sentences naming it.
 * Without: every sentence, except those that name only OTHER set numbers (e.g. the parent
 * retail set's own price) -- pass `about` = the GWP set numbers the text is about.
 */
export function gwpPriceClaims(body: string, setNumber?: string, about: string[] = []): string[] {
  const named = (s: string) => [...s.matchAll(SET_NO)].map((m) => m[0]).filter((n) => !/^(19|20)\d\d$/.test(n));
  return sentences(body).filter((s) => {
    if (setNumber && !new RegExp(`(?:^|\\D)${setNumber}(?:\\D|$)`).test(s)) return false;
    if (!setNumber && about.length) {
      const ns = named(s);
      if (ns.length && !ns.some((n) => about.includes(n))) return false;  // about another (retail) set
    }
    if (!MONEY_RE.test(s) || NOT_SOLD.test(s)) return false;
    if (THRESHOLD.test(s) && !PRICE_WORDS.test(s)) return false;  // a spend requirement, not its price
    return true;
  });
}

export function gate14Check(body: string, f: Gate14Facts): Gate14Finding[] {
  const out: Gate14Finding[] = [];
  const gwpClaims = f.promotional ? new Set(gwpPriceClaims(body, undefined, [f.setNumber])) : new Set<string>();
  for (const s of gwpClaims) out.push({ rule: 'gwp', detail: `${f.setNumber} is a gift with purchase / has no retail price: no price claim; say it isn't sold separately`, sentence: s });
  const others = f.otherSetNumbers ?? new Set<string>();
  for (const s of sentences(body)) {
    const mentionsOther = [...s.matchAll(/\b\d{4,6}\b/g)].some((x) => x[0] !== f.setNumber && others.has(x[0]));
    const comparison = COMPARISON.test(s) || mentionsOther;

    for (const m of s.matchAll(PIECES_RE)) {
      if (NEGATED.test(s.slice(0, m.index ?? 0)) || comparison) continue;
      const q = (m[1] ?? '').toLowerCase(); const n = num(m[2]); const p = f.pieces;
      if (!p) { out.push({ rule: 'pieces', detail: `"${m[0]}" is unverifiable: no catalogue piece count`, sentence: s }); continue; }
      let ok: boolean;
      if (/over|more than/.test(q)) ok = p > n && p <= n * 1.1;
      else if (/under|fewer than/.test(q)) ok = p < n && p >= n * 0.9;
      else if (q) ok = Math.abs(p - n) <= Math.max(2, p * 0.05);
      else ok = Math.abs(n - p) <= p * 0.02;
      if (!ok) out.push({ rule: 'pieces', detail: `"${m[0]}"; catalogue ${p}`, sentence: s });
    }
    for (const m of s.matchAll(MINIFIG_RE)) {
      if (NEGATED.test(s.slice(0, m.index ?? 0)) || CAPACITY.test(s.slice(0, m.index ?? 0)) || comparison) continue;
      const n = /^\d+$/.test(m[1]) ? Number(m[1]) : WORDNUM[m[1].toLowerCase()];
      if (f.minifigs == null) { out.push({ rule: 'minifigs', detail: `"${m[0]}" is unverifiable: no catalogue minifigure count`, sentence: s }); continue; }
      if (n !== f.minifigs) out.push({ rule: 'minifigs', detail: `"${m[0]}"; catalogue ${f.minifigs}`, sentence: s });
    }
    if (f.year && RELEASE_RE.test(s) && !comparison && !/\b(original|first|since|back in|anniversary|retir)/i.test(s)) {
      for (const y of s.match(/\b(19[5-9]\d|20[0-3]\d)\b/g) ?? []) if (Number(y) !== f.year) out.push({ rule: 'year', detail: `mentions ${y}; catalogue ${f.year}`, sentence: s });
    }
    if (gwpClaims.has(s)) { if (LEAK_RE.test(s)) out.push({ rule: 'leak', detail: `narrated source: "${s.match(LEAK_RE)![0]}"`, sentence: s }); continue; }
    const named = NAMED_SOURCE.test(s);
    if (FOREIGN_RE.test(s) && !named) out.push({ rule: 'foreign', detail: 'foreign-currency price without a named source', sentence: s });
    if (/\b(import|estimat)/i.test(s) && /₹/.test(s) && !named) out.push({ rule: 'foreign', detail: '"import/estimated" ₹ price without a named source', sentence: s });
    else if (!comparison && !HYPOTHETICAL.test(s)) {
      for (const m of s.matchAll(INR_RE)) {
        const v = num(m[1]);
        if (!inrAllowed(v, f)) out.push({ rule: 'inr', detail: `₹${m[1]} is not a current displayed price (or derived from one) for ${f.setNumber}`, sentence: s });
      }
    }
    if (LEAK_RE.test(s)) out.push({ rule: 'leak', detail: `narrated source: "${s.match(LEAK_RE)![0]}"`, sentence: s });
  }
  // verdict: every standalone verdict line / "Verdict: X"
  const found = new Set<string>();
  for (const line of body.split('\n')) {
    const t = line.replace(/[*_#>`]/g, '').trim().toUpperCase();
    for (const v of VERDICTS) if (t === v || t.startsWith(`VERDICT: ${v}`) || t === `VERDICT: ${v}.`) found.add(v);
  }
  if (found.size > 1) out.push({ rule: 'verdict', detail: `more than one verdict: ${[...found].join(' + ')}`, sentence: '' });
  else if (found.size === 1 && f.verdict && ![...found][0].startsWith(f.verdict.toUpperCase())) out.push({ rule: 'verdict', detail: `body says ${[...found][0]}, reviews.verdict is ${f.verdict}`, sentence: '' });
  return out;
}
