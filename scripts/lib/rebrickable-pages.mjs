// Page loop and request pacing for scripts/sync-rebrickable.js. Kept as an ES module so tests can import it.
//
// Failure behaviour (G14): a page that cannot be fetched or written ends the run with an error, never a quiet stop.
// The run is complete only when the number of entries processed equals the `count` the API reports for the query.

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Returns an async function that waits so that calls are at least `gapMs` apart.
 * Used for every Rebrickable request (pages and theme lookups), so bursts cannot trigger 429s.
 */
export function createPacer(gapMs, { now = () => Date.now(), sleep = defaultSleep } = {}) {
  let lastAt = null;
  return async function pace() {
    if (lastAt !== null) {
      const wait = lastAt + gapMs - now();
      if (wait > 0) await sleep(wait);
    }
    lastAt = now();
  };
}

/**
 * Walks every page of a Rebrickable list, following `next`.
 *
 * - fetchPage(url) returns the parsed page JSON, or throws.
 * - upsertPage(results) returns { synced, failed, deduped }.
 * - Throws (with the page number) if a page cannot be fetched, a page write fails, or the number of
 *   entries processed does not equal the API's `count`. Nothing is treated as complete unless it is.
 */
export async function paginateCatalogue({
  firstUrl,
  fetchPage,
  upsertPage,
  pageGapMs = 0,
  sleep = defaultSleep,
  log = () => {},
}) {
  const totals = { synced: 0, failed: 0, deduped: 0, entries: 0, pages: 0, apiCount: null };
  let nextUrl = firstUrl;
  let pageNum = 1;

  while (nextUrl) {
    let data;
    try {
      data = await fetchPage(nextUrl);
    } catch (err) {
      throw new Error(`Page ${pageNum} fetch failed: ${err.message}`);
    }
    if (totals.apiCount === null && typeof data?.count === 'number') totals.apiCount = data.count;

    const results = data?.results ?? [];
    if (results.length === 0) break;

    const result = await upsertPage(results);
    totals.synced += result.synced;
    totals.failed += result.failed;
    totals.deduped += result.deduped;
    totals.entries += results.length;
    totals.pages += 1;
    log(pageNum, results.length, result, totals);

    if (result.failed > 0) throw new Error(`Page ${pageNum}: ${result.failed} rows failed to write`);

    nextUrl = data.next ?? null;
    pageNum += 1;
    if (nextUrl && pageGapMs > 0) await sleep(pageGapMs);
  }

  if (totals.apiCount === null) {
    throw new Error('API response has no count field, so completeness cannot be checked');
  }
  // The API count is of raw entries (before the set_number dedup), so the check compares entries, not unique rows.
  if (totals.entries !== totals.apiCount) {
    throw new Error(
      `Incomplete sync: processed ${totals.entries} entries in ${totals.pages} pages, API reports ${totals.apiCount}`,
    );
  }
  return totals;
}
