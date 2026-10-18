// Pure helpers for the US price column written by scripts/populate-mrp.js. No I/O: the job
// passes in the Brickset set records it already fetched, so these add no API calls.

// Rows per write call. Keeps each batch in one request, well under the request size limit.
const WRITE_BATCH = 500;

/** The US retail price in dollars from one Brickset set record, or null when it has none. */
function usdFromSet(set) {
  const usd = set?.LEGOCom?.US?.retailPrice;
  return usd && usd > 0 ? Number(usd) : null;
}

/** Adds each set's dollar price to `into` (set_number -> dollars). Sets with no price are skipped. */
function collectUsd(sets, into = {}) {
  for (const s of sets ?? []) {
    const usd = usdFromSet(s);
    if (usd != null && s.number) into[s.number] = usd;
  }
  return into;
}

/** Rows for the batch write: one per set with a dollar price. */
function usdRows(usdByNumber) {
  return Object.entries(usdByNumber).map(([set_number, us_price_usd]) => ({ set_number, us_price_usd }));
}

/** Splits rows into write batches of at most `size`. */
function batches(rows, size = WRITE_BATCH) {
  const out = [];
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size));
  return out;
}

module.exports = { WRITE_BATCH, usdFromSet, collectUsd, usdRows, batches };
