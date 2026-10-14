// Columns the article and review list cards show. List queries read these, not '*',
// so a list never carries columns the card doesn't use.
import { readingTime } from '@/lib/utils';

/** News card fields; `content` is read only to work out the reading time. */
export const NEWS_CARD_COLS = 'id, slug, title, category, excerpt, hero_image, published_at, content';

/** Review card fields (ReviewCard), with the set it reviews. */
export const REVIEW_CARD_COLS =
  'id, slug, title, rating, verdict, published_at, set:sets(name, image_url, rebrickable_id, set_number, theme)';

type NewsRow = {
  id: string; slug: string; title: string; category: string; excerpt: string;
  hero_image: string | null; published_at: string; content?: string | null;
};

/** Card shape for a cached list: the reading time is kept, the article text is not. */
export function toNewsCard({ content, ...rest }: NewsRow) {
  return { ...rest, reading_time: content ? readingTime(content) : null };
}
