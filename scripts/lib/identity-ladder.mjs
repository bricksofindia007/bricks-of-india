// FP5.4 identity ladder (P4 Step 4c, 27 Sep 2026). Pure: no I/O.
//
// Which catalogue set is this retailer listing? Rules, in order:
//   1. Hard exclusions first (never guessed into a match):
//        - Jaiman "box damage" SKUs ("-DM" suffix)  -> unmatched condition:box_damage (D28)
//        - multi-set listings (several catalogue sets named on one page, e.g.
//          FirstCry variant pages)                   -> unmatched multi_set_listing
//        - a CMF full box sold as one listing        -> unmatched cmf_box
//   2. SKU / structured id: a catalogue set number in the SKU (or the
//      retailer's structured product id) -- accepted ONLY if the catalogue
//      name also matches the listing text. A SKU whose number disagrees with
//      the number in the handle/URL is unmatched sku_handle_conflict (Jaiman).
//   3. Title/handle numbers: EVERY 4-7 digit number is a candidate (never
//      "the first number"); a candidate is accepted only if it's in the
//      catalogue AND its name matches. Exactly one survivor -> match; more
//      than one -> unmatched ambiguous_numbers; none -> step 4.
//      This is what stops "Ferrari F2004" -> 2004, "Unimog U 5023" -> 5023,
//      "Spider-Man 2099" -> 2099 and "NCC-1701" -> 1701.
//   4. Exact catalogue name (normalised) -> match 'name'.
//   5. Otherwise unmatched no_catalogue_match.
// Several listings resolving to one set are ordered by canonicalRank(): match
// method, then OLDEST listing (created_at, id). Never by price or stock (R1).

import { nameMatchesText } from '../../src/lib/set-identity.ts';

const NUM_RE = /(?<![\d])(\d{4,7})(?![\d])/g;
export const MATCH_RANK = { sku: 0, text: 1, name: 2 };

// A catalogue entry's name matches the listing text, or one of its human-approved aliases does
// (public.set_name_aliases, P8 item 3). Aliases are data, never code (G4): e.g. 43019 "Football"
// also answers to "Soccer Ball", approved by Abhinav on 28 Sep 2026 (1,498 pieces, Editions).
export function matchesSetName(entry, text) {
  if (nameMatchesText(entry.name, text)) return true;
  return (entry.aliases ?? []).some((a) => nameMatchesText(a, text));
}

// Piece counts ("(1361 Pieces)", "44 pcs", "6020-piece") are never set numbers --
// the P4 dry run caught 42207 "(1361 Pieces)" and 76269 "(5201 Pieces)"
// colliding with catalogue sets 1361 / 5201.
const stripPieceCounts = (s) => String(s ?? '').replace(/\b(?:\d{1,3}(?:,\d{3})+|\d+)\s*-?\s*(?:pieces?|pcs?|elements)\b/gi, ' ');
const seriesNo = (s) => String(s ?? '').match(/\bseries\s*(\d{1,2})\b/i)?.[1] ?? null;

const norm = (s) => String(s ?? '').toLowerCase().replace(/[™®©]/g, '').replace(/\s+/g, ' ').trim().replace(/^the\s+/, '');
const numbersIn = (s) => [...String(s ?? '').matchAll(NUM_RE)].map((m) => m[1]);

/**
 * @param {{title:string, handle?:string, url?:string, skus?:string[], structuredId?:string, store:string}} listing
 * @param {{byNumber: Map<string,{set_number:string,name:string}>, byName: Map<string,string>}} catalogue
 * @returns {{ok:true, setNumber:string, method:'sku'|'text'|'name'} | {ok:false, reason:string, detail?:string}}
 */
export function resolveIdentity(listing, catalogue) {
  const title = listing.title ?? '';
  const handle = listing.handle ?? '';
  const text = `${title} ${handle.replace(/-/g, ' ')}`;
  const numText = stripPieceCounts(`${title} ${handle.replace(/-/g, ' ')}`);
  const skus = (listing.skus ?? []).map((s) => String(s ?? '').trim()).filter(Boolean);

  // 1. exclusions
  if (skus.some((s) => /-DM$/i.test(s)) || /\bbox damage(d)?\b/i.test(title)) {
    return { ok: false, reason: 'condition:box_damage', detail: skus.join(',') };
  }
  if (/\b(full box|box of \d+|pack of \d+|\d+\s*(?:x|pcs?)?\s*(?:blind )?bags?\b|case of \d+)/i.test(title) && /minifig|series\s*\d/i.test(title)) {
    return { ok: false, reason: 'cmf_box', detail: title };
  }
  const titleNums = [...new Set(numbersIn(numText))];
  const namedSets = titleNums.filter((n) => catalogue.byNumber.has(n) && matchesSetName(catalogue.byNumber.get(n), text));
  if (namedSets.length > 1 || /\b(\d+\s*sets?\s*(in|combo)|combo of|set of \d+ sets|variant)\b/i.test(title) && titleNums.filter((n) => catalogue.byNumber.has(n)).length > 1) {
    return { ok: false, reason: 'multi_set_listing', detail: titleNums.join(',') };
  }

  // 2. SKU / structured id
  const idSources = [...skus, listing.structuredId ?? ''];
  for (const s of idSources) {
    const n = numbersIn(s).find((x) => catalogue.byNumber.has(x));
    if (!n) continue;
    const handleNums = numbersIn(stripPieceCounts(handle.replace(/-/g, ' '))).filter((x) => catalogue.byNumber.has(x));
    if (handleNums.length && !handleNums.includes(n)) {
      return { ok: false, reason: 'sku_handle_conflict', detail: `sku ${n} vs handle ${handleNums.join(',')}` };
    }
    if (matchesSetName(catalogue.byNumber.get(n), text)) return { ok: true, setNumber: n, method: 'sku' };
    // CMF series: the catalogue names a series number after one figure, so
    // match on the cmf_figures series name AND the same series number.
    const series = catalogue.cmfSeries?.get(n);
    if (series && nameMatchesText(series, text) && seriesNo(series) && seriesNo(series) === seriesNo(text)) {
      return { ok: true, setNumber: n, method: 'sku' };
    }
    // A catalogue SKU whose name disagrees is queued, never re-matched to some
    // OTHER set by title/name (the dry run caught 43019 "Football" falling
    // through to 4297455 "Soccer Ball").
    return { ok: false, reason: 'sku_name_mismatch', detail: `sku ${n} = "${catalogue.byNumber.get(n).name}"` };
  }

  // 3. every title/handle number, name-checked
  if (namedSets.length === 1) return { ok: true, setNumber: namedSets[0], method: 'text' };

  // 4. exact catalogue name
  const byName = catalogue.byName.get(norm(title));
  if (byName) return { ok: true, setNumber: byName, method: 'name' };

  return { ok: false, reason: 'no_catalogue_match', detail: titleNums.join(',') || 'no number' };
}

/** Lower = more canonical: match method, then oldest listing. Never price/stock (R1). */
export function canonicalRank(p) {
  return [
    MATCH_RANK[p.method] ?? 9,
    p.createdAt ? Date.parse(p.createdAt) : Number.MAX_SAFE_INTEGER,
    Number(p.productId ?? Number.MAX_SAFE_INTEGER),
  ];
}
export function isMoreCanonical(a, b) {
  const ra = canonicalRank(a), rb = canonicalRank(b);
  for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] < rb[i];
  return false;
}
