/**
 * Review/aggregateRating integrity check for Product JSON-LD on /sets/[slug].
 *
 * Guardrail against the fabricated-rating failure mode (GSC-01 Part C): a
 * set with no matching published review must never end up with a
 * non-empty `review` or `aggregateRating` in its rendered Product schema.
 * Exercises buildProductSchema() directly -- the exact function the live
 * page calls, with the exact review shape page.tsx passes
 * (`set.reviews?.[0] || null`) -- rather than re-implementing the guard
 * logic separately, since a duplicate implementation could pass this check
 * while the real page still leaks a rating.
 *
 * Run: npx tsx scripts/check-review-schema-integrity.ts
 * Wired into: .github/workflows/ci.yml
 */
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { getSecret } from '../src/lib/get-secret';
import { buildProductSchema } from '../src/lib/schemas';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = getSecret('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('::error::NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

async function main() {
  // Paginate to bypass PostgREST's 1000-row cap (see DATA_SOURCES.md / CLAUDE.md).
  const PAGE = 1000;
  const allSets: any[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb
      .from('sets')
      .select('name, set_number, image_url, theme, pieces, reviews(rating, slug, excerpt, published_at)')
      .range(offset, offset + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allSets.push(...data);
    if (data.length < PAGE) break;
  }

  let failures = 0;
  let noReviewChecked = 0;
  let withReviewChecked = 0;

  for (const set of allSets) {
    const publishedReviews = (set.reviews ?? []).filter((r: any) => r.published_at != null);
    const review = publishedReviews[0] ?? null;
    const schema = buildProductSchema(set, [], set.set_number, {}, 'integrity-check', review) as Record<string, unknown>;

    if (!review) {
      noReviewChecked++;
      if ('aggregateRating' in schema || 'review' in schema) {
        failures++;
        console.error(
          `::error::FABRICATED RATING -- set ${set.set_number} (${set.name}) has no published review but the rendered schema includes ${'aggregateRating' in schema ? 'aggregateRating' : ''}${'review' in schema ? ' review' : ''}`,
        );
      }
    } else {
      withReviewChecked++;
      if (!('aggregateRating' in schema) || !('review' in schema)) {
        failures++;
        console.error(
          `::error::MISSING RATING -- set ${set.set_number} (${set.name}) has a published review but the rendered schema is missing aggregateRating/review`,
        );
      }
    }
  }

  console.log(
    `Checked ${allSets.length} sets: ${noReviewChecked} without a review (verified no fabricated rating), ${withReviewChecked} with a review (verified rating present).`,
  );

  if (failures > 0) {
    console.error(`\n❌ Review schema integrity check FAILED -- ${failures} violation(s)`);
    process.exit(1);
  }
  console.log('✅ Review schema integrity check passed');
}

main().catch((err) => {
  console.error('::error::check-review-schema-integrity crashed:', err);
  process.exit(1);
});
