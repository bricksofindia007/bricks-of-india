/**
 * noindex_override reconciliation — report-only.
 *
 * Trigger: the 2026-08-29 tier2 noindex cutoff (migration
 * 20260829010000_tier2_stale_noindex_override.sql) flagged 14,836 sets
 * (index_tier='tier2' AND year<2020 AND zero price_history rows at that
 * time) with sets.noindex_override = true. That flag is deliberately NOT
 * trigger-maintained (see the migration's own comment) -- a flagged set
 * that later gets its first real price will NOT automatically flip back
 * to indexed. This script finds candidates for that reversal.
 *
 * Does exactly three things, in order:
 *   1. Fetch every sets row where noindex_override = true.
 *   2. Check price_history for any of them that now have at least one row
 *      (i.e. got priced SINCE the override was applied -- this script has
 *      no way to distinguish "priced before but missed" from "priced
 *      after," but the original cutoff already verified zero price_history
 *      existed for all 14,836 at application time, so any match found now
 *      is necessarily new since then).
 *   3. Print the candidate list. Does NOT write anything to the database --
 *      un-flagging is a decision for Abhinav to make after seeing real
 *      run-to-run volume, not something this script does automatically.
 *
 * Run: npx tsx scripts/noindex-override-reconciliation.ts
 * Not yet wired into a GitHub Actions workflow -- run manually for now.
 * Once real output volume from a few runs is known, promote to a
 * scheduled workflow (see catalogue-audit.yml for the pattern) and decide
 * then whether un-flagging should become automatic.
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getSecret } from '../src/lib/get-secret';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = getSecret('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

// PostgREST caps any single request at 1000 rows regardless of .range() --
// confirmed repo-wide convention (scrape-now.mjs's knownSets loop,
// catalogue-audit.ts's fetchAllPaginated). 14,836 flagged sets needs 15
// pages; a price_history lookup batch could in principle also exceed 1000
// rows if a single 200-set_number IN-clause batch matches heavily, so this
// helper is reused for both.
async function fetchAllPaginated<T>(
  table: string,
  select: string,
  filterFn?: (q: any) => any
): Promise<T[]> {
  const PAGE = 1000;
  let all: T[] = [];
  let offset = 0;
  for (;;) {
    let q = sb.from(table).select(select).range(offset, offset + PAGE - 1);
    if (filterFn) q = filterFn(q);
    const { data, error } = await q;
    if (error) throw new Error(`${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    all = all.concat(data as T[]);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

interface FlaggedSet {
  set_number: string;
  name: string;
  year: number | null;
}

async function main() {
  console.log('noindex_override reconciliation -- report only, no writes.\n');

  // ── 1. Every currently-flagged set ────────────────────────────────────────
  const flagged = await fetchAllPaginated<FlaggedSet>('sets', 'set_number, name, year', (q) =>
    q.eq('noindex_override', true)
  );
  console.log(`1. Flagged sets (noindex_override = true): ${flagged.length}`);

  if (flagged.length === 0) {
    console.log('\nNothing flagged -- nothing to reconcile.');
    return;
  }

  // ── 2. Which of them now have ANY price_history row ────────────────────────
  // Batched IN-clause lookups (200 set_numbers per batch, matching this
  // repo's existing chunking convention -- e.g. lab/price-drops's setIds
  // loop) rather than pulling all ~735K price_history rows into memory.
  // Each batch's result is itself paginated via fetchAllPaginated, since a
  // heavily-priced batch could exceed the 1000-row PostgREST cap on its own.
  const BATCH = 200;
  const nowPriced = new Set<string>();
  for (let i = 0; i < flagged.length; i += BATCH) {
    const batchSetNumbers = flagged.slice(i, i + BATCH).map((s) => s.set_number);
    const rows = await fetchAllPaginated<{ set_id: string }>('price_history', 'set_id', (q) =>
      q.in('set_id', batchSetNumbers)
    );
    for (const r of rows) nowPriced.add(r.set_id);
    process.stdout.write(
      `\r2. Checked ${Math.min(i + BATCH, flagged.length)}/${flagged.length} flagged sets against price_history...`
    );
  }
  console.log(''); // newline after the progress carriage-return

  const candidates = flagged.filter((s) => nowPriced.has(s.set_number));

  // ── 3. Report ────────────────────────────────────────────────────────────
  console.log(`\n3. Candidates for un-flagging (now have price history, still noindex_override = true): ${candidates.length}`);
  if (candidates.length === 0) {
    console.log('None this run.');
    return;
  }

  console.log('\nset_number | year | name');
  console.log('-----------|------|-----');
  for (const c of candidates.sort((a, b) => a.set_number.localeCompare(b.set_number))) {
    console.log(`${c.set_number} | ${c.year ?? 'n/a'} | ${c.name}`);
  }

  console.log(
    `\n${candidates.length} candidate(s) found. No changes made -- noindex_override was NOT cleared for any of these.` +
      ' Review and clear manually (or via a future automated pass) once the real run-to-run volume is known.'
  );
}

main().catch((err) => {
  console.error('ERROR:', err instanceof Error ? err.message : err);
  process.exit(1);
});
