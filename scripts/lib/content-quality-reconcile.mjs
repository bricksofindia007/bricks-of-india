/**
 * Shared upsert/reconcile logic for writers of content_quality_issues.
 *
 * BOI Fix Brief (2026-08-24), Phase 0.2 + urgent follow-up same day:
 * content-linter.mjs's first version of this logic (merged, then found
 * broken within hours) scoped its "currently open" lookup and its
 * auto-resolve pass across the WHOLE table -- not just the check_names
 * the calling script itself is capable of producing. content_quality_
 * issues is written by at least 3 independent scripts with disjoint
 * (mostly) check_name sets: content-linter.mjs, visual-renderer.mjs,
 * and reviews-source-refresh.mjs. The first live run after that "fix"
 * shipped wrongly auto-resolved 184+ real open issues it never checks
 * for at all (image_render_broken, page_load_error, horizontal_scroll
 * -- all visual-renderer.mjs's), simply because content-linter.mjs's
 * own scan doesn't produce those check_names and therefore never "saw"
 * them as still-present. Confirmed live via content_fix_log/fix_detail
 * evidence, reverted, and this shared module built so every writer
 * scopes reconciliation to ONLY the check_names it declares owning --
 * a single, tested implementation instead of three separately-drifting
 * copies.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} sb
 * @param {Array<{checked_at: string, article_id: string|null, article_slug: string, section: string, check_name: string, severity: string, detail: string, auto_fixable: boolean, resolved: false}>} issues
 *   This run's freshly-detected issues (any shape content_quality_issues accepts, minus first_seen_at).
 * @param {string[]} ownedCheckNames
 *   Every check_name this script is capable of producing. Reconciliation's
 *   "open" lookup and "no longer detected -> auto-resolve" pass are BOTH
 *   scoped to this list -- an issue this script has never heard of is
 *   never touched, regardless of whether this run detected it.
 * @param {string} sourceLabel
 *   Short label for fix_detail on auto-resolved rows (e.g. the calling
 *   script's filename), so a reconciliation's origin is traceable later.
 * @returns {Promise<{inserted: number, touched: number, resolved: number, openBefore: number}>}
 */
export async function reconcileIssues(sb, issues, ownedCheckNames, sourceLabel) {
  const ownedList = [...new Set(ownedCheckNames)];
  if (ownedList.length === 0) {
    console.warn('  reconcileIssues: ownedCheckNames is empty -- nothing will ever be reconciled or auto-resolved.');
  }

  const unowned = issues.filter(i => !ownedList.includes(i.check_name));
  if (unowned.length > 0) {
    console.warn(`  WARNING: ${unowned.length} detected issue(s) have a check_name not in ownedCheckNames (${[...new Set(unowned.map(i => i.check_name))].join(', ')}) -- these will still be written, but won't participate in auto-resolve scoping. Add them to ownedCheckNames.`);
  }

  // De-dup the CALLER's own batch by (article_slug, check_name) before
  // anything else. Found live (2026-08-24): visual-renderer.mjs calls
  // flag(art, 'page_load_error', ...) once per viewport, so an article
  // that fails on BOTH desktop and mobile produces two issues sharing
  // one key within a SINGLE run -- and since openByKey below is a
  // point-in-time snapshot, not updated as each batch writes, two
  // same-key issues landing in the same Promise.all(batch.map(...))
  // pass could both see "not yet open" and both attempt an INSERT,
  // racing each other into the same duplicate-key error this whole
  // module exists to prevent. Merge instead: keep the most severe
  // severity, join every distinct detail with '; '.
  const SEVERITY_RANK = { critical: 3, warning: 2, info: 1 };
  const dedupedByKey = new Map();
  for (const issue of issues) {
    const key = `${issue.article_slug}|${issue.check_name}`;
    const existing = dedupedByKey.get(key);
    if (!existing) { dedupedByKey.set(key, { ...issue }); continue; }
    if ((SEVERITY_RANK[issue.severity] ?? 0) > (SEVERITY_RANK[existing.severity] ?? 0)) existing.severity = issue.severity;
    if (issue.detail && !existing.detail.includes(issue.detail)) existing.detail = `${existing.detail}; ${issue.detail}`;
    existing.auto_fixable = existing.auto_fixable || issue.auto_fixable;
  }
  const dedupedIssues = [...dedupedByKey.values()];
  if (dedupedIssues.length !== issues.length) {
    console.log(`  [${sourceLabel}] merged ${issues.length - dedupedIssues.length} same-run duplicate detection(s) (e.g. one check_name failing on multiple viewports) before writing.`);
  }
  issues = dedupedIssues;

  // Paginated fetch (PostgREST 1000-row cap, per CLAUDE.md), scoped to
  // only this caller's own check_names.
  const openByKey = new Map(); // `${slug}|${check}` -> id
  {
    const PAGE = 1000;
    let offset = 0;
    for (;;) {
      const { data: page, error } = await sb
        .from('content_quality_issues')
        .select('id, article_slug, check_name')
        .eq('resolved', false)
        .in('check_name', ownedList)
        .range(offset, offset + PAGE - 1);
      if (error) { console.error('  Open-issue fetch error:', error.message); break; }
      for (const row of page ?? []) openByKey.set(`${row.article_slug}|${row.check_name}`, row.id);
      if (!page || page.length < PAGE) break;
      offset += PAGE;
    }
  }
  const openBefore = openByKey.size;
  console.log(`  [${sourceLabel}] ${openBefore} currently-open row(s) in scope to reconcile against.`);

  // Fix B (2026-09-26): batched writes. This loop issued one request per
  // issue (~500-950 PATCHes a day); every request writes a ~2.5 KB Supabase
  // gateway log line and log ingest is over the Free quota. Recurring rows
  // are now one id-keyed upsert per batch (only the columns sent are
  // updated -- the table has no triggers and every other NOT NULL column has
  // a default), new rows one insert per batch, and auto-resolves one .in()
  // update per batch. A failed batch falls back to per-row writes so a bad
  // row is still logged by key exactly as before.
  const seenKeys = new Set();
  let inserted = 0, touched = 0;
  const WRITE_BATCH = 500;
  const toTouch = [];
  const toInsert = [];
  for (const issue of issues) {
    const key = `${issue.article_slug}|${issue.check_name}`;
    seenKeys.add(key);
    const existingId = openByKey.get(key);
    if (existingId) toTouch.push({ key, row: { id: existingId, checked_at: issue.checked_at, detail: issue.detail, severity: issue.severity, auto_fixable: issue.auto_fixable } });
    else toInsert.push({ key, row: { ...issue, first_seen_at: issue.checked_at } });
  }

  for (let i = 0; i < toTouch.length; i += WRITE_BATCH) {
    const chunk = toTouch.slice(i, i + WRITE_BATCH);
    const { error } = await sb.from('content_quality_issues').upsert(chunk.map((c) => c.row), { onConflict: 'id' });
    if (!error) { touched += chunk.length; continue; }
    console.error(`  Batch update error (${error.message}) -- retrying ${chunk.length} row(s) individually`);
    for (const { key, row } of chunk) {
      const { id, ...fields } = row;
      const { error: e } = await sb.from('content_quality_issues').update(fields).eq('id', id);
      if (e) console.error(`  Update error (${key}):`, e.message);
      else touched++;
    }
  }

  for (let i = 0; i < toInsert.length; i += WRITE_BATCH) {
    const chunk = toInsert.slice(i, i + WRITE_BATCH);
    const { error } = await sb.from('content_quality_issues').insert(chunk.map((c) => c.row), { defaultToNull: false });
    if (!error) { inserted += chunk.length; continue; }
    console.error(`  Batch insert error (${error.message}) -- retrying ${chunk.length} row(s) individually`);
    for (const { key, row } of chunk) {
      const { error: e } = await sb.from('content_quality_issues').insert(row);
      if (e) console.error(`  Insert error (${key}):`, e.message);
      else inserted++;
    }
  }

  // Auto-resolve: previously open IN THIS SCRIPT'S OWN SCOPE, not
  // re-detected this run. Never touches a check_name outside ownedList.
  const goneKeys = [...openByKey.keys()].filter(k => !seenKeys.has(k));
  let resolvedCount = 0;
  const RESOLVE_BATCH = 200; // ids go in the URL; 200 uuids keeps it well under limits
  const resolvedAt = new Date().toISOString();
  const resolveFields = { resolved: true, resolved_at: resolvedAt, fix_detail: `Auto-resolved: no longer detected by ${sourceLabel}` };
  for (let i = 0; i < goneKeys.length; i += RESOLVE_BATCH) {
    const keys = goneKeys.slice(i, i + RESOLVE_BATCH);
    const { error } = await sb.from('content_quality_issues').update(resolveFields).in('id', keys.map((k) => openByKey.get(k)));
    if (!error) { resolvedCount += keys.length; continue; }
    console.error(`  Batch auto-resolve error (${error.message}) -- retrying ${keys.length} row(s) individually`);
    for (const key of keys) {
      const { error: e } = await sb.from('content_quality_issues').update(resolveFields).eq('id', openByKey.get(key));
      if (e) console.error(`  Auto-resolve error (${key}):`, e.message);
      else resolvedCount++;
    }
  }

  console.log(`  [${sourceLabel}] ${inserted} new, ${touched} recurring (touched), ${resolvedCount} auto-resolved (no longer detected).`);
  return { inserted, touched, resolved: resolvedCount, openBefore };
}
