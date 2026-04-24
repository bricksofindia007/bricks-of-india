import Link from 'next/link';
import { formatPrice, slugify } from '@/lib/utils';
import { Badge, BestPriceBadge } from '@/components/ui/Badge';
import { SetImage } from '@/components/sets/SetImage';
import type { LegoSet, Price } from '@/lib/supabase';

interface SetCardProps {
  set: LegoSet;
  bestPrice?: Price | null;
  priceCount?: number;
}

export function SetCard({ set, bestPrice, priceCount }: SetCardProps) {
  const slug = `${set.set_number}-${slugify(set.name)}`;

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
            {bestPrice?.price_inr ? (
              <div className="flex items-center gap-1.5">
                <BestPriceBadge />
                <span className="font-price font-bold text-deal-green text-sm">
                  {formatPrice(bestPrice.price_inr)}
                </span>
              </div>
            ) : set.lego_mrp_inr ? (
              <span className="font-price text-sm text-dark font-bold">
                MRP: {formatPrice(set.lego_mrp_inr)}
              </span>
            ) : (
              <span className="text-xs text-gray-400">Check price</span>
            )}
            {(priceCount ?? 0) > 1 && (
              <p className="text-xs text-gray-400 mt-0.5">{priceCount} stores</p>
            )}
          </div>
          <span className="text-xs font-bold text-primary group-hover:underline shrink-0">Compare →</span>
        </div>
      </div>
    </Link>
  );
}
