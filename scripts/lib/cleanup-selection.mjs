// Pure selection logic for cleanup-published-assets.js -- no DB/storage
// access, so every rule below is unit-testable (tests/cleanup-selection.test.ts).
//
// Deny-by-default (issue #177, 2026-09-24): a path is deleted only if
//   1. a row in an explicitly allow-listed terminal status references it, AND
//   2. that row is past the age guard (when on), AND
//   3. NO row in any other status -- pending_approval, approved,
//      publish_blocked, rejected, anything added later, or NULL -- references
//      the same path.
// Rule 3 is what makes this deny-by-default rather than just an allow-list:
// a status nobody has thought about yet protects its assets automatically,
// and two rows sharing one storage_url (a rework, a re-render reusing a
// filename) can't have the terminal row's cleanup delete the live row's file.

export const TERMINAL_STATUSES = Object.freeze(['posted_both', 'discarded']);

export function urlToPath(url, bucket) {
  if (typeof url !== 'string') return null;
  const marker = `/object/public/${bucket}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

// Every bucket path a single row references (storage_url + any qc frames).
export function rowPaths(row, bucket) {
  const out = [];
  const main = urlToPath(row.storage_url, bucket);
  if (main) out.push(main);
  const frames = Array.isArray(row.qc_frame_urls) ? row.qc_frame_urls : [];
  for (const f of frames) {
    const p = urlToPath(f, bucket);
    if (p) out.push(p);
  }
  return out;
}

export function isTerminal(status) {
  return TERMINAL_STATUSES.includes(status);
}

// posted_at is compared as an ISO string, matching the previous PostgREST
// `.lt('posted_at', cutoff)` semantics exactly -- including the known gap
// that a NULL posted_at (discarded rows are never posted) never passes the
// guard, so such rows are only reachable with the guard off.
export function passesAgeGuard(row, ageCutoffIso) {
  if (!ageCutoffIso) return true;
  if (!row.posted_at) return false;
  return new Date(row.posted_at).getTime() < new Date(ageCutoffIso).getTime();
}

// Paths referenced by any non-terminal row. These are never deleted.
export function protectedPaths(rows, bucket) {
  const out = new Set();
  for (const r of rows) {
    if (isTerminal(r.status)) continue;
    for (const p of rowPaths(r, bucket)) out.add(p);
  }
  return out;
}

// Candidate paths from terminal, age-eligible rows.
export function candidatePaths(rows, bucket, ageCutoffIso) {
  const out = new Set();
  for (const r of rows) {
    if (!isTerminal(r.status)) continue;
    if (!passesAgeGuard(r, ageCutoffIso)) continue;
    for (const p of rowPaths(r, bucket)) out.add(p);
  }
  return out;
}

// Derives the set-num prefix (e.g. "76342-1") from a root-level
// social-assets filename for each of the three known social-automation naming
// shapes, or null if none match. Feed images come in two forms -- a bare
// "{set_num}_feed.jpg" and numbered variants "{set_num}_feed_7.jpg".
export function extractSetNum(filename) {
  if (filename.endsWith('_shorts.mp4')) return filename.slice(0, -'_shorts.mp4'.length);
  if (filename.endsWith('_reels.mp4')) return filename.slice(0, -'_reels.mp4'.length);
  const feedMatch = filename.match(/^(.+)_feed(?:_\d+)?\.jpg$/);
  if (feedMatch) return feedMatch[1];
  return null;
}

// social-automation root files: selected only when the set's posted_sets row
// is fully posted on all three platforms (and past the age guard -- applied
// by the caller's query). Anything not matching a known naming shape is
// never selected.
export function rootFilePaths(rootFileNames, fullyPostedSetNums) {
  const sets = new Set(fullyPostedSetNums);
  return rootFileNames.filter((name) => {
    const setNum = extractSetNum(name);
    return setNum !== null && sets.has(setNum);
  });
}

// Final delete list = candidates minus protected. Returns both so the caller
// can log exactly what the deny layer held back.
export function finalizeSelection(candidates, protectedSet) {
  const toDelete = [];
  const blocked = [];
  for (const p of candidates) {
    if (protectedSet.has(p)) blocked.push(p);
    else toDelete.push(p);
  }
  return { toDelete: toDelete.sort(), blocked: blocked.sort() };
}
