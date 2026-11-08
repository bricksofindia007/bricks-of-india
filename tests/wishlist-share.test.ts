// Shared guest wishlist (decision 21c, order 1520): the link helpers, the page's rules, and the Instagram card (decision 21e).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanSetNumbers, parseWishlistSegment, wishlistSegment, wishlistSharePath } from '../src/lib/wishlist-share';
import { MY_SETS_LIMIT, isSetNumber } from '../src/lib/my-collection';
import { toolCardCopy, cardFileName, drawShareCard, CARD_SIZES, type CardCanvas } from '../src/lib/share-card';
import { SHARE_TEXT, VISIBLE_CHANNELS } from '../src/lib/share';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const PAGE = 'src/app/wishlist/[sets]/page.tsx';

describe('link values', () => {
  it('keeps well-formed set numbers in order and drops duplicates', () => {
    expect(cleanSetNumbers(['75192', '10307', '75192'])).toEqual(['75192', '10307']);
  });
  it('drops anything that is not a set number, so unknown or hostile text never reaches the link', () => {
    expect(cleanSetNumbers(['75192', '<script>', '../x', '', 42, null, '10307-1'])).toEqual(['75192', '10307-1']);
  });
  it('caps the list at the existing 500-set limit', () => {
    const many = Array.from({ length: 600 }, (_, i) => String(10000 + i));
    const cleaned = cleanSetNumbers(many);
    expect(MY_SETS_LIMIT).toBe(500);
    expect(cleaned).toHaveLength(500);
    expect(cleaned[499]).toBe(String(10000 + 499));
  });
  it('builds the path from the set numbers and returns null when none is valid', () => {
    expect(wishlistSharePath(['75192', 'bad', '10307'])).toBe('/wishlist/75192,10307');
    expect(wishlistSharePath(['bad'])).toBeNull();
    expect(wishlistSegment([])).toBe('');
  });
  it('parses a path segment back into set numbers, dropping anything else', () => {
    expect(parseWishlistSegment('75192, 10307,<b>,')).toEqual(['75192', '10307']);
  });
  it('uses the same set-number rule as the wishlist itself', () => {
    expect(isSetNumber('75192')).toBe(true);
    expect(isSetNumber('75192x')).toBe(false);
  });
});

describe('shared list page', () => {
  const src = read(PAGE);

  it('is behind shareEnabled, which stays off', () => {
    expect(FEATURE_FLAGS.shareEnabled).toBe(false);
    expect(src).toMatch(/if \(!shareEnabled\(FEATURE_FLAGS\)\) notFound\(\)/);
  });
  it('uses a literal one-hour revalidate and reads no cookies or headers (G1)', () => {
    expect(src).toMatch(/export const revalidate = 3600;/);
    expect(src).not.toMatch(/cookies\(|headers\(|document\.cookie|fetch\(/);
  });
  it('is noindex in its head, and its canonical is its own address', () => {
    expect(src).toMatch(/robots: \{ index: false, follow: true \}/);
    expect(src).toMatch(/path: `\$\{WISHLIST_PATH\}\/\$\{sets\}`/);
  });
  it('prices come only through the approved reader, and only inside the freshness rule', () => {
    expect(src).toMatch(/getPriceSummaries\(/);
    expect(src).toMatch(/isPriceFresh\(summary\.best_scraped_at\)/);
    expect(src).not.toMatch(/from\('store_prices'\)|from\('price_history'\)|set_price_summary/);
  });
  it('shows no rupee total and no price timestamp (G19)', () => {
    expect(src).not.toMatch(/reduce\(|total|formatIst|toLocaleString/i);
    expect(src).not.toMatch(/best_scraped_at[^;]*\}/);
  });
  it('uses the approved line and the open-site button', () => {
    expect(SHARE_TEXT.collectionShared).toBe('Your list, shared. Take a bow');
    expect(src).toMatch(/\{SHARE_TEXT\.collectionShared\}/);
    expect(src).toMatch(/Open Bricks of India/);
  });
  it('keeps only catalogue matches and returns not-found when nothing matches', () => {
    expect(src).toMatch(/const found = wanted\.filter\(\(n\) => byNumber\.has\(n\)\)/);
    expect(src).toMatch(/if \(found\.length === 0\) notFound\(\)/);
  });
});

describe('Instagram card (decision 21e)', () => {
  it('Instagram is a visible channel', () => {
    expect(VISIBLE_CHANNELS).toContain('instagram');
  });
  it('the tool card has its title and the approved line, and no count', () => {
    const copy = toolCardCopy('Minifig HQ');
    expect(copy.heading).toBe('Minifig HQ');
    expect(copy.line).toBe(SHARE_TEXT.previewCaption);
    expect(copy.count).toBe('');
  });
  it('draws no count line on the tool card', () => {
    const texts: string[] = [];
    const ctx: CardCanvas & { texts: string[] } = {
      fillStyle: '', font: '', textAlign: 'start', fillRect() {}, fillText(t: string) { texts.push(t); }, texts,
    };
    drawShareCard(ctx, 'story', toolCardCopy('Minifig HQ'));
    expect(texts).toEqual(['Minifig HQ', SHARE_TEXT.previewCaption, 'bricksofindia.com']);
    expect(CARD_SIZES.story).toEqual({ width: 1080, height: 1920 });
  });
  it('names the saved file without the visitor or the list', () => {
    expect(cardFileName('tool', 'story')).toBe('bricks-of-india-story.png');
  });
  it('the card code and the share control carry no rupee value and no storage read', () => {
    for (const f of ['src/lib/share-card.ts', 'src/components/share/ShareControl.tsx']) {
      expect(read(f), f).not.toMatch(/₹|\bINR\b|localStorage|sessionStorage|document\.cookie/);
    }
    expect(read('src/components/share/ShareControl.tsx')).toMatch(/drawShareCard\(ctx, 'story', toolCardCopy\(title\)\)/);
    expect(read('src/components/share/ShareControl.tsx')).toMatch(/canvas\.toBlob/);
  });
});
