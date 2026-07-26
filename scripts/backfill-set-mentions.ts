/**
 * GEO-05b one-time backfill: run linkFirstSetMentions() against every
 * already-published article (news, blog, reviews) and write back any
 * body that gained links. Idempotent -- re-running against
 * already-linked content finds no new unlinked mentions to add (the
 * mention text itself becomes part of a markdown link, which no longer
 * matches the 4 raw-number patterns extractSetNumberCandidates() looks
 * for), so a second run is a safe no-op.
 *
 * Run: npx tsx scripts/backfill-set-mentions.ts
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getSecret } from '../src/lib/get-secret';
import { linkFirstSetMentions } from '../src/lib/link-set-mentions';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = getSecret('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('::error::NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const tables = ['news_articles', 'blog_posts', 'reviews'] as const;

async function main() {
  let articlesScanned = 0;
  let articlesUpdated = 0;
  let totalLinksAdded = 0;
  const diffSamples: { table: string; slug: string; linked: { setNumber: string; setSlug: string }[] }[] = [];

  for (const table of tables) {
    const { data, error } = await sb.from(table).select('id, slug, content').not('content', 'is', null);
    if (error) throw error;

    for (const row of data ?? []) {
      articlesScanned++;
      const { content, linked } = await linkFirstSetMentions(row.content as string, sb);
      if (linked.length === 0) continue;

      const { error: updateErr } = await sb.from(table).update({ content }).eq('id', row.id);
      if (updateErr) throw updateErr;

      articlesUpdated++;
      totalLinksAdded += linked.length;
      if (diffSamples.length < 10) {
        diffSamples.push({ table, slug: row.slug as string, linked });
      }
    }
  }

  console.log(`Articles scanned: ${articlesScanned}`);
  console.log(`Articles updated: ${articlesUpdated}`);
  console.log(`Total links added: ${totalLinksAdded}`);
  console.log(`\nSample of ${diffSamples.length} updated articles:`);
  for (const s of diffSamples) {
    console.log(`  [${s.table}] ${s.slug}: linked ${s.linked.map((l) => `${l.setNumber}->/sets/${l.setSlug}`).join(', ')}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
