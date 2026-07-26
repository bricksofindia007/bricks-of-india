/**
 * GEO-05b integrity check: every /sets/[slug] link inserted by
 * linkFirstSetMentions() (forward, article -> set) must still resolve.
 *
 * getSetData() in src/app/sets/[slug]/page.tsx resolves purely by the
 * slug's leading number (`slug.split('-')[0]`) -- the rest of the slug
 * (the slugified name) is decorative and never validated by the route
 * itself. So a set RENAME does not actually 404 an old link; only a set
 * being fully DELETED (its number no longer in `sets` at all) does. This
 * check fails the build only on genuine 404s, and separately warns
 * (non-fatal) on cosmetic slug drift, so a rename doesn't false-alarm CI.
 *
 * Run: npx tsx scripts/check-set-mention-links.ts
 * Wired into: .github/workflows/ci.yml
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getSecret } from '../src/lib/get-secret';
import { slugify } from '../src/lib/utils';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = getSecret('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('::error::NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const LINK_RE = /\]\(\/sets\/([0-9]{4,7}-[a-z0-9-]*)\)/g;
const tables = ['news_articles', 'blog_posts', 'reviews'] as const;

async function main() {
  const foundSlugs = new Map<string, { table: string; articleSlug: string }[]>(); // linkedSlug -> occurrences

  for (const table of tables) {
    const { data, error } = await sb.from(table).select('slug, content').not('content', 'is', null);
    if (error) throw error;
    for (const row of data ?? []) {
      const content = row.content as string;
      let m: RegExpExecArray | null;
      LINK_RE.lastIndex = 0;
      while ((m = LINK_RE.exec(content)) !== null) {
        const linkedSlug = m[1];
        const list = foundSlugs.get(linkedSlug) ?? [];
        list.push({ table, articleSlug: row.slug as string });
        foundSlugs.set(linkedSlug, list);
      }
    }
  }

  if (foundSlugs.size === 0) {
    console.log('No auto-linked /sets/ links found -- nothing to check.');
    return;
  }

  const setNumbers = Array.from(foundSlugs.keys()).map((s) => s.split('-')[0]);
  const { data: setsData, error: setsErr } = await sb.from('sets').select('set_number, name').in('set_number', setNumbers);
  if (setsErr) throw setsErr;
  const nameByNumber = new Map((setsData ?? []).map((s: { set_number: string; name: string }) => [s.set_number, s.name]));

  let failures = 0;
  let staleWarnings = 0;

  for (const [linkedSlug, occurrences] of Array.from(foundSlugs.entries())) {
    const setNumber = linkedSlug.split('-')[0];
    const name = nameByNumber.get(setNumber);

    if (!name) {
      failures++;
      console.error(
        `::error::404 -- set ${setNumber} (linked as /sets/${linkedSlug}) no longer exists in sets. Referenced from: ${occurrences.map((o: { table: string; articleSlug: string }) => `${o.table}/${o.articleSlug}`).join(', ')}`,
      );
      continue;
    }

    const currentSlug = `${setNumber}-${slugify(name)}`;
    if (currentSlug !== linkedSlug) {
      staleWarnings++;
      console.warn(
        `::warning::cosmetic drift, not a 404 -- /sets/${linkedSlug} still resolves (route matches by number prefix only) but the set's current slug is /sets/${currentSlug}. Referenced from: ${occurrences.map((o: { table: string; articleSlug: string }) => `${o.table}/${o.articleSlug}`).join(', ')}`,
      );
    }
  }

  console.log(`Checked ${foundSlugs.size} distinct auto-linked slugs across ${tables.length} tables.`);
  console.log(`  -- 404s (set deleted entirely): ${failures}`);
  console.log(`  -- cosmetic slug drift (set renamed, link still resolves): ${staleWarnings}`);

  if (failures > 0) {
    console.error(`\n❌ Set-mention link integrity check FAILED -- ${failures} link(s) point to a deleted set`);
    process.exit(1);
  }
  console.log('✅ Set-mention link integrity check passed');
}

main().catch((err) => {
  console.error('::error::check-set-mention-links crashed:', err);
  process.exit(1);
});
