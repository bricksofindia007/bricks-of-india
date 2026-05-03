#!/usr/bin/env node
/**
 * RADAR-02 — Signal deduper
 * Reads raw_signals where dedup_status='pending', oldest first.
 * Pass 1: exact URL hash dedupe
 * Pass 2: exact title hash dedupe (within still-pending)
 * Pass 3: cross-source token Jaccard >= 0.75 (within still-pending)
 * Pass 4: remaining pending -> 'unique'
 *
 * Flags:
 *   --dry-run   Print actions, do not write to DB
 *   --verbose   Print per-group preview in Pass 3
 */

require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

const DRY_RUN = process.argv.includes('--dry-run');
const VERBOSE = process.argv.includes('--verbose');

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const STOPWORDS = new Set([
  // generic English
  'the','a','an','and','or','but','of','in','on','at','to','for','with','by',
  'is','are','was','were','be','been','being','this','that','these','those',
  'it','its','as','from','into','about','over','under','up','down','out','off',
  // LEGO-domain noise
  'lego','leak','leaks','leaked','rumor','rumors','rumored','reveal','reveals',
  'revealed','new','first','look','looks','official','officially','set','sets'
]);

function normalize(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(title) {
  const norm = normalize(title);
  if (!norm) return new Set();
  return new Set(
    norm.split(' ').filter(t => t.length > 1 && !STOPWORDS.has(t))
  );
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

async function fetchPending() {
  const { data, error } = await sb
    .from('raw_signals')
    .select('id, source_name, source_tier, url, url_hash, title, title_hash, fetched_at')
    .eq('dedup_status', 'pending')
    .order('fetched_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function batchUpdate(ids, patch) {
  if (DRY_RUN) return;
  if (ids.length === 0) return;
  // Update in chunks of 100 to keep payloads sane
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const { error } = await sb
      .from('raw_signals')
      .update(patch)
      .in('id', chunk);
    if (error) throw error;
  }
}

function newGroupId() {
  return crypto.randomUUID();
}

(async () => {
  const all = await fetchPending();
  console.log(`Fetched ${all.length} pending signals.`);
  if (all.length === 0) {
    console.log('DEDUPE SUMMARY: total=0 exact_url_dupes=0 title_dupes=0 cross_source_groups=0 cross_source_secondary=0 final_unique=0');
    return;
  }

  // Track row state in memory
  const rows = all.map(r => ({ ...r, _status: 'pending', _group: null }));

  // Pass 1 — exact URL hash dedupe
  let exactUrlDupes = 0;
  {
    const buckets = new Map();
    for (const r of rows) {
      if (!buckets.has(r.url_hash)) buckets.set(r.url_hash, []);
      buckets.get(r.url_hash).push(r);
    }
    for (const [, group] of buckets) {
      if (group.length < 2) continue;
      const gid = newGroupId();
      // group is already oldest-first because rows were ordered by fetched_at
      group[0]._group = gid; // primary stays pending for now
      for (let i = 1; i < group.length; i++) {
        group[i]._status = 'duplicate';
        group[i]._group = gid;
        exactUrlDupes++;
      }
    }
  }

  // Pass 2 — title hash dedupe within still-pending
  let titleDupes = 0;
  {
    const stillPending = rows.filter(r => r._status === 'pending');
    const buckets = new Map();
    for (const r of stillPending) {
      if (!buckets.has(r.title_hash)) buckets.set(r.title_hash, []);
      buckets.get(r.title_hash).push(r);
    }
    for (const [, group] of buckets) {
      if (group.length < 2) continue;
      const gid = newGroupId();
      group[0]._group = group[0]._group || gid;
      const sharedGid = group[0]._group;
      for (let i = 1; i < group.length; i++) {
        group[i]._status = 'duplicate';
        group[i]._group = sharedGid;
        titleDupes++;
      }
    }
  }

  // Pass 3 — cross-source fuzzy match within still-pending
  const stillPending = rows.filter(r => r._status === 'pending');
  // Pre-tokenize
  for (const r of stillPending) r._tokens = tokenize(r.title);

  // Union-Find for transitive grouping
  const parent = new Map();
  const find = (x) => {
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)));
      x = parent.get(x);
    }
    return x;
  };
  const union = (a, b) => {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };
  for (const r of stillPending) parent.set(r.id, r.id);

  for (let i = 0; i < stillPending.length; i++) {
    for (let j = i + 1; j < stillPending.length; j++) {
      const a = stillPending[i], b = stillPending[j];
      // Skip same-source pairs in fuzzy pass — exact passes already handled in-source dupes
      if (a.source_name === b.source_name) continue;
      const sim = jaccard(a._tokens, b._tokens);
      if (sim >= 0.75) union(a.id, b.id);
    }
  }

  // Build groups from UF roots
  const groups = new Map();
  for (const r of stillPending) {
    const root = find(r.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(r);
  }

  let crossSourceGroups = 0;
  let crossSourceSecondary = 0;
  const verbosePreview = [];
  for (const [, group] of groups) {
    if (group.length < 2) continue;
    crossSourceGroups++;
    // Pick primary: lowest source_tier number, tiebreak oldest fetched_at
    group.sort((x, y) => {
      if (x.source_tier !== y.source_tier) return x.source_tier - y.source_tier;
      return new Date(x.fetched_at) - new Date(y.fetched_at);
    });
    const primary = group[0];
    const gid = newGroupId();
    primary._status = 'cross_source_primary';
    primary._group = gid;
    for (let i = 1; i < group.length; i++) {
      group[i]._status = 'cross_source_secondary';
      group[i]._group = gid;
      crossSourceSecondary++;
    }
    if (VERBOSE) verbosePreview.push({ primary, secondaries: group.slice(1) });
  }

  // Pass 4 — remaining pending -> unique
  let finalUnique = 0;
  for (const r of rows) {
    if (r._status === 'pending') {
      r._status = 'unique';
      finalUnique++;
    }
  }

  // Verbose preview
  if (VERBOSE && verbosePreview.length > 0) {
    console.log('\n--- CROSS-SOURCE GROUPS (Pass 3 preview) ---');
    verbosePreview.forEach((g, idx) => {
      console.log(`\nGroup ${idx + 1}:`);
      console.log(`  PRIMARY  [T${g.primary.source_tier} ${g.primary.source_name}] ${g.primary.title}`);
      for (const s of g.secondaries) {
        console.log(`  SECONDARY [T${s.source_tier} ${s.source_name}] ${s.title}`);
      }
    });
    console.log('\n--- END PREVIEW ---\n');
  } else if (VERBOSE) {
    console.log('\n(No cross-source groups formed at threshold 0.75)\n');
  }

  // Apply updates (skipped if DRY_RUN)
  const byStatus = { duplicate: [], cross_source_primary: [], cross_source_secondary: [], unique: [] };
  const groupAssignments = new Map(); // id -> group_id
  for (const r of rows) {
    if (r._status === 'pending') continue; // shouldn't happen after Pass 4
    byStatus[r._status].push(r.id);
    if (r._group) groupAssignments.set(r.id, r._group);
  }

  if (DRY_RUN) {
    console.log('[DRY-RUN] Would apply:');
    console.log(`  duplicate=${byStatus.duplicate.length}`);
    console.log(`  cross_source_primary=${byStatus.cross_source_primary.length}`);
    console.log(`  cross_source_secondary=${byStatus.cross_source_secondary.length}`);
    console.log(`  unique=${byStatus.unique.length}`);
  } else {
    // Update in two phases: status batches, then group_id assignments
    await batchUpdate(byStatus.duplicate, { dedup_status: 'duplicate' });
    await batchUpdate(byStatus.cross_source_primary, { dedup_status: 'cross_source_primary' });
    await batchUpdate(byStatus.cross_source_secondary, { dedup_status: 'cross_source_secondary' });
    await batchUpdate(byStatus.unique, { dedup_status: 'unique' });

    // Group IDs — one update per distinct group_id (small N)
    const groupBuckets = new Map();
    for (const [id, gid] of groupAssignments) {
      if (!groupBuckets.has(gid)) groupBuckets.set(gid, []);
      groupBuckets.get(gid).push(id);
    }
    for (const [gid, ids] of groupBuckets) {
      await batchUpdate(ids, { dedup_group_id: gid });
    }
  }

  console.log(
    `DEDUPE SUMMARY: total=${rows.length} ` +
    `exact_url_dupes=${exactUrlDupes} ` +
    `title_dupes=${titleDupes} ` +
    `cross_source_groups=${crossSourceGroups} ` +
    `cross_source_secondary=${crossSourceSecondary} ` +
    `final_unique=${finalUnique}` +
    (DRY_RUN ? ' [DRY-RUN]' : '')
  );
})().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
