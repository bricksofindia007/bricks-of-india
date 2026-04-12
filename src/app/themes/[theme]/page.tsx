import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ThemeGrid } from '@/components/sets/ThemeGrid';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';
import { THEMES } from '@/lib/brand';
import { THEME_IDS, getAllSetsForTheme, type RebrickableSet } from '@/lib/rebrickable';

interface Props {
  params: { theme: string };
}

export async function generateStaticParams() {
  return THEMES.map((t) => ({ theme: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const theme = THEMES.find((t) => t.slug === params.theme);
  if (!theme) return { title: 'Theme Not Found' };
  return {
    title: `LEGO ${theme.name} Sets India 2026 — Compare Prices | Bricks of India`,
    description: `All LEGO ${theme.name} sets available in India. Compare prices across Indian stores and find the best deals.`,
    alternates: { canonical: `https://bricksofindia.com/themes/${params.theme}` },
  };
}

/**
 * Strips the Rebrickable suffix (e.g. "75192-1" → "75192").
 * Some sets use "-2", "-3" variants; we always strip the last -N group.
 */
function stripSuffix(setNum: string): string {
  return setNum.replace(/-\d+$/, '');
}

export default async function ThemePage({ params }: Props) {
  const theme = THEMES.find((t) => t.slug === params.theme);
  if (!theme) notFound();

  const themeIds = THEME_IDS[params.theme] ?? [];
  let sets: any[] = [];

  // ── Strategy 1: Rebrickable API with full pagination ──────────────────────
  // Only used when we have a known Rebrickable theme ID.
  // Each fetch is cached for 24 h by Next.js; no extra cost on repeated builds.
  if (themeIds.length > 0) {
    try {
      // Fetch all pages for every relevant theme ID, then deduplicate
      const rawResults = await Promise.all(themeIds.map((id) => getAllSetsForTheme(id)));
      const seen = new Set<string>();
      const rbSets: RebrickableSet[] = rawResults.flat().filter((s) => {
        if (seen.has(s.set_num)) return false;
        seen.add(s.set_num);
        return true;
      });

      if (rbSets.length > 0) {
        // Strip suffixes so we can match against Supabase set_number
        const setNumbers = rbSets.map((s) => stripSuffix(s.set_num));

        // Batch-fetch matching Supabase rows for prices + India-specific data.
        // Supabase IN() with a large array is fine via PostgREST.
        const { data: supabaseSets } = await supabase
          .from('sets')
          .select('id, set_number, lego_mrp_inr, age_range, theme, subtheme, minifigs, prices(*)')
          .in('set_number', setNumbers);

        const supabaseMap = new Map<string, any>(
          (supabaseSets ?? []).map((s) => [s.set_number, s]),
        );

        // Merge Rebrickable set data with Supabase price/MRP data
        sets = rbSets.map((rb) => {
          const sn = stripSuffix(rb.set_num);
          const sup = supabaseMap.get(sn);
          return {
            id:            sup?.id ?? rb.set_num,
            set_number:    sn,
            rebrickable_id: rb.set_num,
            name:          rb.name,
            year:          rb.year,
            pieces:        rb.num_parts ?? null,
            image_url:     rb.set_img_url || null,
            theme:         sup?.theme ?? theme.name,
            subtheme:      sup?.subtheme ?? null,
            minifigs:      sup?.minifigs ?? null,
            description:   null,
            age_range:     sup?.age_range ?? null,
            lego_mrp_inr:  sup?.lego_mrp_inr ?? null,
            created_at:    '',
            updated_at:    '',
            prices:        sup?.prices ?? [],
          };
        });
      }
    } catch (err) {
      console.error(`Theme page Rebrickable fetch failed for "${params.theme}":`, err);
      // Fall through to Strategy 2
    }
  }

  // ── Strategy 2: Supabase only (fallback / no theme ID) ────────────────────
  if (sets.length === 0) {
    const { data } = await supabase
      .from('sets')
      .select('*, prices(*)')
      .ilike('theme', `%${theme.name}%`)
      .order('year', { ascending: false })
      .limit(200);
    sets = data ?? [];
  }

  const setCount = sets.length;

  return (
    <div className="bg-white min-h-screen">
      {/* Header — dark navy matches the premium footer */}
      <div className="bg-primary-dark py-10 px-4">
        <div className="max-w-site mx-auto">
          {/* Breadcrumb */}
          <nav className="flex items-center gap-1.5 text-sm text-white/50 mb-5 flex-wrap">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span>/</span>
            <Link href="/#browse-themes" className="hover:text-white transition-colors">Themes</Link>
            <span>/</span>
            <span className="text-white/90 font-bold">{theme.name}</span>
          </nav>

          {/* Title row */}
          <div className="flex items-center gap-4 mb-3">
            <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 border-2 border-white/20">
              <ImageWithFallback
                srcs={[theme.image, '/images/lego-placeholder.svg']}
                alt={theme.name}
                fill
                className="object-cover"
              />
            </div>
            <div>
              <h1
                className="font-heading text-white"
                style={{ fontSize: 'clamp(2rem, 5vw, 3rem)', lineHeight: 1.1 }}
              >
                LEGO {theme.name.toUpperCase()}
              </h1>
              <p className="text-white/60 text-sm mt-1 font-body">
                {setCount > 0
                  ? `${setCount} sets found — live price comparison across all Indian stores.`
                  : `All LEGO ${theme.name} sets in India with live price comparison.`}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-site mx-auto px-4 py-10">
        {sets.length === 0 ? (
          <div className="text-center py-16">
            <div className="relative w-24 h-24 mx-auto mb-4 rounded-2xl overflow-hidden">
              <ImageWithFallback
                srcs={[theme.image, '/images/lego-placeholder.svg']}
                alt={theme.name}
                fill
                className="object-cover"
              />
            </div>
            <h2 className="font-heading text-dark text-3xl mb-2">{theme.name} Sets Loading</h2>
            <p className="text-text-secondary font-body">We&apos;re syncing the set database. Check back shortly.</p>
          </div>
        ) : (
          <ThemeGrid sets={sets} />
        )}
      </div>
    </div>
  );
}
