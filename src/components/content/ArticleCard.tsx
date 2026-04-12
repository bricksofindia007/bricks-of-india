'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { ImageWithFallback } from '@/components/ui/ImageWithFallback';
import { formatDate, readingTime } from '@/lib/utils';
import type { BlogPost, NewsArticle, Review } from '@/lib/supabase';

const PLACEHOLDER = '/images/lego-placeholder.svg';
// Generic LEGO set image used as second-level fallback when hero_image is missing
const GENERIC_FALLBACK = 'https://cdn.rebrickable.com/media/sets/10329-1/10329-1.jpg';

interface ArticleCardProps {
  article: BlogPost | NewsArticle;
  type: 'blog' | 'news';
}

export function ArticleCard({ article, type }: ArticleCardProps) {
  const href = `/${type}/${article.slug}`;

  // Build fallback chain: stored image → generic Rebrickable → local placeholder
  const imageSrcs = [
    article.hero_image,
    GENERIC_FALLBACK,
    PLACEHOLDER,
  ].filter(Boolean) as string[];

  return (
    <Link
      href={href}
      className="group block bg-white rounded-xl border border-border hover:border-primary transition-all duration-200 hover:shadow-lg overflow-hidden"
    >
      {/* Image — 16:9 */}
      <div className="relative bg-surface overflow-hidden" style={{ aspectRatio: '16/9' }}>
        <ImageWithFallback
          srcs={imageSrcs}
          alt={article.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
        />
        <div className="absolute top-3 left-3">
          <Badge variant={type === 'news' ? 'secondary' : 'blue'}>{article.category}</Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-dark text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors mb-2">
          {article.title}
        </h3>
        <p className="text-text-secondary text-sm line-clamp-2 mb-3 font-body">{article.excerpt}</p>
        <div className="flex items-center justify-between text-xs text-text-secondary">
          <span>{formatDate(article.published_at)}</span>
          <span>{readingTime(article.content)}</span>
        </div>
      </div>
    </Link>
  );
}

// ─── ReviewCard ──────────────────────────────────────────────────────────────

interface ReviewSetData {
  name: string;
  image_url?: string | null;
  rebrickable_id?: string | null;
  set_number?: string;
  theme?: string;
}

interface ReviewCardProps {
  review: Review & { set?: ReviewSetData };
}

export function ReviewCard({ review }: ReviewCardProps) {
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

  const imageSrcs = [
    review.set?.image_url,
    review.set?.rebrickable_id
      ? `https://cdn.rebrickable.com/media/sets/${review.set.rebrickable_id}.jpg`
      : null,
    review.set?.set_number
      ? `https://images.brickset.com/sets/images/${review.set.set_number}-1.jpg`
      : null,
    PLACEHOLDER,
  ].filter(Boolean) as string[];

  return (
    <Link
      href={`/reviews/${review.slug}`}
      className="group block bg-white rounded-xl border border-border hover:border-primary transition-all duration-200 hover:shadow-lg overflow-hidden"
    >
      <div className="relative bg-surface overflow-hidden" style={{ aspectRatio: '16/9' }}>
        <ImageWithFallback
          srcs={imageSrcs}
          alt={review.title}
          fill
          className="object-contain p-4 group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 640px) 100vw, 33vw"
        />
        <div className="absolute top-3 left-3">
          <Badge variant="secondary">Review</Badge>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-accent text-sm">{stars}</span>
          <span className="text-xs text-text-secondary">({review.rating}/5)</span>
        </div>
        <h3 className="font-bold text-dark text-base leading-tight line-clamp-2 group-hover:text-primary transition-colors mb-2">
          {review.title}
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-xs text-text-secondary">{formatDate(review.published_at)}</span>
          <span className="text-sm font-bold text-secondary">
            {review.verdict?.toLowerCase().includes('skip') ? 'Skip it' : 'Buy it'}
          </span>
        </div>
      </div>
    </Link>
  );
}
