import Link from 'next/link';
import { formatPrice, slugify } from '@/lib/utils';
import { Badge, BestPriceBadge, OnlyAtBadge, DealBadge } from '@/components/ui/Badge';
import { SetImage } from '@/components/sets/SetImage';
import type { LegoSet } from '@/lib/supabase';
import { priceLabel, storeName, type SetPriceSummary } from '@/lib/price-summary';

interface SetCardProps {
  set: LegoSet;
  // Shown when there is no fresh summary price (e.g. an in-stock row older
  // than 12h): displayed, never badged.
  bestPrice?: { price_inr: number | null; in_stock?: boolean | null; scraped_at?: string | null } | null;
  priceCount?: number;
  // PR-B: public.set_price_summary row. Carries the fresh in-stock best price,
  // the MRP anchor (R2), deal tier (R3) and the R5/R6 label. Badges come ONLY
  // from here, so every card on the site applies the same rules.
  summary?: SetPriceSummary | null;
}

export function SetCard({ set, bestPrice, priceCount, summary }: SetCardProps) {
  const slug = `${set.set_number}-${slugify(set.name)}`;
  const freshPrice = summary?.best_price_inr ?? null;
  const shownPrice = freshPrice ?? bestPrice?.price_inr ?? null;
  const label = priceLabel(summary);
  // R2: the anchor wins over any other MRP.
  const mrp = summary?.anchor_mrp_inr ?? set.lego_mrp_inr;
  const mrpVerified = summary?.anchor_mrp_inr != null || set.mrp_verified;

  return (
    <Link
      href={`/sets/${slug}`}
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
          <Badge variant="grey">{set.theme || 'LEGO'}</Badge>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-gray-400 font-price mb-1">{set.set_number}</p>
        <h3 className="font-bold text-dark text-sm leading-tight line-clamp-2 group-hover:text-primary transition-colors mb-2">
          {set.name}
        </h3>

        {/* Meta */}
        <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
          {set.pieces && <span>{set.pieces.toLocaleString()} pcs</span>}
          {set.year && <span>· {set.year}</span>}
          {set.age_range && <span>· {set.age_range}</span>}
        </div>

        {/* Price */}
        <div className="flex items-center justify-between gap-2">
          <div>
            {shownPrice ? (
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {label?.kind === 'best' && <BestPriceBadge />}
                  {label?.kind === 'only' && <OnlyAtBadge store={storeName(label.stores[0])} />}
                  <span className={`font-price font-bold text-sm ${freshPrice ? 'text-deal-green' : 'text-dark'}`}>
                    {formatPrice(shownPrice)}
                  </span>
                </div>
                {summary?.deal_tier && <DealBadge tier={summary.deal_tier} pct={summary.discount_pct} />}
              </div>
            ) : mrp ? (
              <span className="font-price text-sm text-dark font-bold">
                {mrpVerified ? 'MRP' : 'Est. MRP'}: {formatPrice(mrp)}
              </span>
            ) : (
              <span className="text-xs text-gray-400 italic">Price TBD</span>
            )}

          </div>
          <span className="text-xs font-bold text-primary group-hover:underline shrink-0">Compare →</span>
        </div>
      </div>
    </Link>
  );
}
