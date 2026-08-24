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

  const seenKeys = new Set();
  let inserted = 0, touched = 0;
  const BATCH = 50;
  for (let i = 0; i < issues.length; i += BATCH) {
    const batch = issues.slice(i, i + BATCH);
    await Promise.all(batch.map(async (issue) => {
      const key = `${issue.article_slug}|${issue.check_name}`;
      seenKeys.add(key);
      const existingId = openByKey.get(key);
      if (existingId) {
        const { error } = await sb.from('content_quality_issues')
          .update({ checked_at: issue.checked_at, detail: issue.detail, severity: issue.severity, auto_fixable: issue.auto_fixable })
          .eq('id', existingId);
        if (error) console.error(`  Update error (${key}):`, error.message);
        else touched++;
      } else {
        const { error } = await sb.from('content_quality_issues').insert({ ...issue, first_seen_at: issue.checked_at });
        if (error) console.error(`  Insert error (${key}):`, error.message);
        else inserted++;
      }
    }));
  }

  // Auto-resolve: previously open IN THIS SCRIPT'S OWN SCOPE, not
  // re-detected this run. Never touches a check_name outside ownedList.
  const goneKeys = [...openByKey.keys()].filter(k => !seenKeys.has(k));
  let resolvedCount = 0;
  for (let i = 0; i < goneKeys.length; i += BATCH) {
    const batch = goneKeys.slice(i, i + BATCH);
    await Promise.all(batch.map(async (key) => {
      const id = openByKey.get(key);
      const { error } = await sb.from('content_quality_issues')
        .update({ resolved: true, resolved_at: new Date().toISOString(), fix_detail: `Auto-resolved: no longer detected by ${sourceLabel}` })
        .eq('id', id);
      if (error) console.error(`  Auto-resolve error (${key}):`, error.message);
      else resolvedCount++;
    }));
  }

  console.log(`  [${sourceLabel}] ${inserted} new, ${touched} recurring (touched), ${resolvedCount} auto-resolved (no longer detected).`);
  return { inserted, touched, resolved: resolvedCount, openBefore };
}
