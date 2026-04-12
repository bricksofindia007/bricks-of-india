import Link from 'next/link';
import Image from 'next/image';
import { formatPrice, slugify } from '@/lib/utils';
import { Badge, BestPriceBadge } from '@/components/ui/Badge';
import type { LegoSet, Price } from '@/lib/supabase';

interface SetCardProps {
  set: LegoSet;
  bestPrice?: Price | null;
  priceCount?: number;
}

export function SetCard({ set, bestPrice, priceCount }: SetCardProps) {
  const slug = `${set.set_number}-${slugify(set.name)}`;

  // Prefer stored image_url, then Rebrickable CDN using the full rebrickable_id
  // (which preserves the -1 suffix the CDN requires), never use set_number alone.
  const imgSrc =
    set.image_url ??
    (set.rebrickable_id
      ? `https://cdn.rebrickable.com/media/sets/${set.rebrickable_id}.jpg`
      : null);

  return (
    <Link href={`/sets/${slug}`} className="group block bg-white rounded-xl border-2 border-border hover:border-primary transition-all duration-200 hover:shadow-lg overflow-hidden">
      {/* Image */}
      <div className="relative bg-light-grey aspect-square overflow-hidden">
        {imgSrc ? (
          <Image
            src={imgSrc}
            alt={set.name}
            fill
            className="object-contain p-3 group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl">🧱</span>
          </div>
        )}
        {/* Theme badge overlay */}
        <div className="absolute top-2 left-2">
          <Badge variant="grey">{set.theme || 'LEGO®'}</Badge>
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <p className="text-xs text-gray-400 font-price mb-1">{set.set_number}</p>
        <h3 className="font-bold text-dark text-sm leading-tight line-clamp-2 group-hover:text-accent-blue transition-colors mb-2">
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
              <span className="text-xs text-gray-400">Check price →</span>
            )}
            {priceCount && priceCount > 1 && (
              <p className="text-xs text-gray-400 mt-0.5">{priceCount} stores</p>
            )}
          </div>
          <span className="text-xs font-bold text-accent-blue group-hover:underline">Compare →</span>
        </div>
      </div>
    </Link>
  );
}
