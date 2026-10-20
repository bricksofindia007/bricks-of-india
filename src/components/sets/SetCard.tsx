import { TrackedNextLink } from '@/components/analytics/TrackedNextLink';
import { formatPrice, slugify } from '@/lib/utils';
import { Badge, BestPriceBadge, OnlyAtBadge, DealBadge } from '@/components/ui/Badge';
import { SetImage } from '@/components/sets/SetImage';
import { FreshOnly } from '@/components/ui/FreshOnly';
import type { LegoSet } from '@/lib/supabase';
import { priceLabel, storeName, type SetPriceSummary } from '@/lib/price-summary';
import { shownTheme } from '@/lib/theme-display';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { HeartSlot } from '@/components/saved/CollectionSlots';

interface SetCardProps {
  set: LegoSet;
  // Accepted from callers but not shown: a price on the card must name a store, and this fallback does not.
  bestPrice?: { price_inr: number | null; in_stock?: boolean | null; scraped_at?: string | null } | null;
  priceCount?: number;
  // PR-B: public.set_price_summary row. Carries the fresh in-stock best price,
  // the MRP anchor (R2), deal tier (R3) and the R5/R6 label. Badges come ONLY
  // from here, so every card on the site applies the same rules.
  summary?: SetPriceSummary | null;
  // Optional: when a page passes this, the card link records a click with the
  // best-price store (registry id and display name) and the card position.
  trackAs?: { pageType: string; storeId?: string | null; storeName?: string | null; position?: number };
}

export function SetCard({ set, priceCount, summary, trackAs }: SetCardProps) {
  const slug = `${set.set_number}-${slugify(set.name)}`;
  // A price is shown only when a store can be named for it. With no store recorded in the summary, or with no
  // summary at all (the fallback price), the price is not shown and the MRP line stands in.
  const storesKnown = (summary?.best_store_ids?.length ?? 0) > 0;
  const freshPrice = storesKnown ? summary?.best_price_inr ?? null : null;
  const shownPrice = freshPrice;
  const label = priceLabel(summary);
  // R2: the anchor wins over any other MRP.
  const mrp = summary?.anchor_mrp_inr ?? set.lego_mrp_inr;
  const mrpVerified = summary?.anchor_mrp_inr != null || set.mrp_verified;

  return (
    <TrackedNextLink
      href={`/sets/${slug}`}
      event={trackAs ? 'click_related_set' : undefined}
      params={trackAs ? { page_type: trackAs.pageType, store: trackAs.storeId ?? undefined, store_name: trackAs.storeName ?? undefined, set_number: set.set_number, position: trackAs.position } : undefined}
      className="group block bg-white rounded-xl border border-border hover:border-primary transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 overflow-hidden"
    >
      {/* Image */}
      <div className="relative bg-surface aspect-square overflow-hidden">
        <SetImage
          set={set}
          className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
        />
        {/* Theme badge overlay */}
        <div className="absolute top-2 left-2">
          <Badge variant="grey">{shownTheme(set.theme) || 'LEGO'}</Badge>
        </div>
        {FEATURE_FLAGS.myCollectionHearts && (
          <div className="absolute top-2 right-2">
            <HeartSlot enabled set={set.set_number} name={set.name} image_url={set.image_url} pieces={set.pieces} theme={set.theme} year={set.year} />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-gray-600 font-price mb-1">{set.set_number}</p>
        <h3 className="font-bold text-dark text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors mb-2">
          {set.name}
        </h3>

        {/* Meta */}
        <div className="flex items-center gap-2 text-xs text-gray-600 mb-3">
          {set.pieces != null && set.pieces > 0 ? <span>{set.pieces.toLocaleString()} pcs</span> : null}
          {set.year && <span>· {set.year}</span>}
          {set.age_range && <span>· {set.age_range}</span>}
        </div>

        {/* Price */}
        <div className="flex items-center justify-between gap-2">
          <div>
            {shownPrice ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <FreshOnly scrapedAt={summary?.best_scraped_at}>
                    {(label?.kind === 'best' || label?.kind === 'tie') && <BestPriceBadge />}
                    {label?.kind === 'only' && <OnlyAtBadge store={storeName(label.stores[0])} />}
                  </FreshOnly>
                  <span className={`font-price font-bold text-sm ${freshPrice ? 'text-green-700' : 'text-dark'}`}>
                    {formatPrice(shownPrice)}
                  </span>
                </div>
                {summary?.deal_tier && (
                  <FreshOnly scrapedAt={summary.best_scraped_at}>
                    <DealBadge tier={summary.deal_tier} pct={summary.discount_pct} />
                  </FreshOnly>
                )}
              </div>
            ) : mrp && mrpVerified ? (
              <span className="font-price text-sm text-dark font-bold">
                MRP: {formatPrice(mrp)}
              </span>
            ) : (
              <span className="text-xs text-gray-600 italic">Price TBD</span>
            )}

          </div>
          <span className="text-xs font-bold text-primary group-hover:underline shrink-0">Compare →</span>
        </div>
      </div>
    </TrackedNextLink>
  );
}
