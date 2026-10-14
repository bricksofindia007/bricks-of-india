import { describe, it, expect } from 'vitest';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArticleCard, ReviewCard } from '../src/components/content/ArticleCard';
import { NEWS_CARD_COLS, REVIEW_CARD_COLS, toNewsCard } from '../src/lib/article-cards';

const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(' ');

// A full row as `select('*')` returned it before.
const NEWS_FULL = {
  id: 'n1', slug: 'a-news-story', title: 'A news story', category: 'News', excerpt: 'Short **summary** of the story.',
  hero_image: 'https://example.com/hero.jpg', published_at: '2026-10-04T08:00:00Z', content: words(950),
  seo_title: 'SEO title', seo_description: 'SEO description', created_at: '2026-10-04T07:00:00Z', verdict: null, set_number: '75419',
};

const REVIEW_FULL = {
  id: 'r1', set_id: '75419', title: 'Death Star review', slug: 'death-star-review', content: words(2000), verdict: 'buy',
  rating: 4.5, youtube_url: null, published_at: '2026-10-03T08:00:00Z', created_at: '2026-10-03T07:00:00Z',
  hero_image: 'https://example.com/r.jpg', excerpt: 'x', seo_title: 's', seo_description: 'd', updated_at: '2026-10-03T07:00:00Z',
  source_retailer: 'x', source_price_inr: 1, source_stock_status: 'x', source_checked_at: '2026-10-03T07:00:00Z', verdict_disclaimer_variant: null,
  set: { name: 'Death Star', image_url: 'https://example.com/s.jpg', rebrickable_id: '75419-1', set_number: '75419', theme: 'Star Wars' },
};

const pick = (row: Record<string, unknown>, cols: string) =>
  Object.fromEntries(cols.replace(/set:sets\([^)]*\)/, 'set').split(',').map((c) => c.trim()).map((c) => [c, row[c]]));

describe('list cards show the same with the narrow columns', () => {
  it('news card: identical HTML, reading time kept, article text not kept', () => {
    const before = renderToStaticMarkup(h(ArticleCard, { article: NEWS_FULL as any, type: 'news' }));
    const card = toNewsCard(pick(NEWS_FULL, NEWS_CARD_COLS) as any);
    expect(card).not.toHaveProperty('content');
    expect(card.reading_time).toBe('5 min read');
    expect(renderToStaticMarkup(h(ArticleCard, { article: card as any, type: 'news' }))).toBe(before);
  });
  it('home news (narrow columns incl. content): identical HTML', () => {
    const before = renderToStaticMarkup(h(ArticleCard, { article: NEWS_FULL as any, type: 'news' }));
    expect(renderToStaticMarkup(h(ArticleCard, { article: pick(NEWS_FULL, NEWS_CARD_COLS) as any, type: 'news' }))).toBe(before);
  });
  it('review card: identical HTML without the review text', () => {
    const before = renderToStaticMarkup(h(ReviewCard, { review: REVIEW_FULL as any }));
    const narrow = pick(REVIEW_FULL, REVIEW_CARD_COLS);
    expect(narrow).not.toHaveProperty('content');
    expect(renderToStaticMarkup(h(ReviewCard, { review: narrow as any }))).toBe(before);
  });
});
