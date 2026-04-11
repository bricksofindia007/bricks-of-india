import Link from 'next/link';
import Image from 'next/image';
import { formatDate, readingTime } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';
import type { BlogPost, NewsArticle, Review } from '@/lib/supabase';

interface ArticleCardProps {
  article: BlogPost | NewsArticle;
  type: 'blog' | 'news';
}

export function ArticleCard({ article, type }: ArticleCardProps) {
  const href = `/${type}/${article.slug}`;

  return (
    <Link href={href} className="group block bg-white rounded-xl border-2 border-border hover:border-primary transition-all duration-200 hover:shadow-lg overflow-hidden">
      {/* Image */}
      <div className="relative bg-light-grey h-48 overflow-hidden">
        {article.hero_image ? (
          <Image
            src={article.hero_image}
            alt={article.title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/10">
            <span className="text-5xl">{type === 'news' ? '📰' : '📝'}</span>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <Badge variant={type === 'news' ? 'secondary' : 'blue'}>{article.category}</Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-bold text-dark text-base leading-tight line-clamp-2 group-hover:text-accent-blue transition-colors mb-2">
          {article.title}
        </h3>
        <p className="text-gray-500 text-sm line-clamp-2 mb-3 font-body">{article.excerpt}</p>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{formatDate(article.published_at)}</span>
          <span>{readingTime(article.content)}</span>
        </div>
      </div>
    </Link>
  );
}

interface ReviewCardProps {
  review: Review & { set?: { name: string; image_url?: string; theme?: string } };
}

export function ReviewCard({ review }: ReviewCardProps) {
  const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);

  return (
    <Link href={`/reviews/${review.slug}`} className="group block bg-white rounded-xl border-2 border-border hover:border-primary transition-all duration-200 hover:shadow-lg overflow-hidden">
      <div className="relative bg-light-grey h-48 overflow-hidden">
        {review.set?.image_url ? (
          <Image
            src={review.set.image_url}
            alt={review.title}
            fill
            className="object-contain p-4 group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 100vw, 33vw"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-5xl">🧱</span>
          </div>
        )}
        <div className="absolute top-3 left-3">
          <Badge variant="secondary">Review</Badge>
        </div>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-primary text-sm">{stars}</span>
          <span className="text-xs text-gray-400">({review.rating}/5)</span>
        </div>
        <h3 className="font-bold text-dark text-base leading-tight line-clamp-2 group-hover:text-accent-blue transition-colors mb-2">
          {review.title}
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400">{formatDate(review.published_at)}</span>
          <span className="text-sm font-bold text-secondary">
            {review.verdict?.toLowerCase().includes('skip') ? '👎 Skip it' : '👍 Buy it'}
          </span>
        </div>
      </div>
    </Link>
  );
}
