// Shared guest wishlist (decision 21c, order 1520): the link helpers, the page's rules, and the Instagram card (decision 21e).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanSetNumbers, parseWishlistSegment, setPagePath, wishlistSegment, wishlistSharePath } from '../src/lib/wishlist-share';
import { formatPrice } from '../src/lib/utils';
import { MY_SETS_LIMIT, isSetNumber } from '../src/lib/my-collection';
import { toolCardCopy, cardFileName, drawShareCard, CARD_SIZES, type CardCanvas } from '../src/lib/share-card';
import { SHARE_TEXT, SHARE_TARGET_IDS, VISIBLE_CHANNELS } from '../src/lib/share';
import { sanitizeParams } from '../src/lib/analytics';
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
  it('reads through the shared loader, which takes prices only from the approved reader (G3)', () => {
    expect(src).toMatch(/loadWishlistSets\(wanted\)/);
    expect(src).not.toMatch(/from\('store_prices'\)|from\('price_history'\)|set_price_summary/);
    const loader = read('src/lib/wishlist-sets.ts');
    expect(loader).toMatch(/getPriceSummaries\(/);
    expect(loader).toMatch(/isPriceFresh\(summary\.best_scraped_at\)/);
  });
  it('shows no rupee total and no price timestamp (G19)', () => {
    expect(src).not.toMatch(/reduce\(|total|formatIst|toLocaleString/i);
    expect(src).not.toMatch(/best_scraped_at/);
  });
  it('uses the approved heading, the approved start button, and not the sharer line', () => {
    expect(src).toMatch(/\{SHARE_TEXT\.wishlistHeading\}/);
    expect(src).toMatch(/\{SHARE_TEXT\.wishlistStart\}/);
    expect(src).not.toMatch(/collectionShared/);
    expect(src).not.toMatch(/Open Bricks of India/);
  });
  it('returns not-found when nothing matches', () => {
    expect(src).toMatch(/if \(found\.length === 0\) notFound\(\)/);
  });
});

describe('shared page: approved wording (owner, 8 Nov 2026, 14:38 IST)', () => {
  it('the heading, the no-price line, the start button and the metadata title are exact', () => {
    expect(SHARE_TEXT.wishlistHeading).toBe('Somebody has plans for your wallet.');
    expect(SHARE_TEXT.wishlistNoPrice).toBe('See the set page for prices');
    expect(SHARE_TEXT.wishlistStart).toBe('Start your own wishlist');
    expect(SHARE_TEXT.wishlistMetaTitle).toBe('A LEGO wishlist, shared with you');
  });
  it('the metadata description is the existing previewCaption constant', () => {
    expect(read(PAGE)).toMatch(/description: SHARE_TEXT\.previewCaption/);
    expect(SHARE_TEXT.previewCaption).toBe('Can you feel it');
  });
  it('each set links to its set page in the same format as the set cards', () => {
    expect(setPagePath('75192', 'UCS Millennium Falcon')).toBe('/sets/75192-ucs-millennium-falcon');
    expect(read('src/components/sets/SetCard.tsx')).toMatch(/\/sets\/\$\{slug\}/);
    expect(read('src/components/sets/SetCard.tsx')).toMatch(/`\$\{set\.set_number\}-\$\{slugify\(set\.name\)\}`/);
    expect(read(PAGE)).toMatch(/setPagePath\(s\.set_number, s\.name\)/);
  });
  it('uses formatPrice from utils, and the hand-written formatter and the platform comment are gone', () => {
    const src = read(PAGE);
    expect(src).toMatch(/import \{ formatPrice \} from '@\/lib\/utils'/);
    expect(src).not.toMatch(/function inr\(/);
    expect(src).not.toMatch(/Netlify/);
    expect(src).toMatch(/formatPrice\(s\.price\)/);
  });
  it('the price the page would show matches formatPrice for two sets', () => {
    expect(formatPrice(12999)).toBe('₹12,999');
    expect(formatPrice(104999)).toBe('₹1,04,999');
  });
});

describe('robots: /wishlist/ (owner, order 1560)', () => {
  const robots = read('public/robots.txt');
  const blocks = robots.split(/\n\n+/).filter((b) => b.startsWith('User-agent:'));
  const block = (agent: string) => blocks.find((b) => b.split('\n')[0] === `User-agent: ${agent}`) ?? '';
  it('the general crawler group disallows /wishlist/', () => {
    expect(block('*')).toContain('Disallow: /wishlist/');
  });
  for (const agent of ['facebookexternalhit', 'Facebot', 'Twitterbot']) {
    it(`${agent} has its own group that allows /wishlist/`, () => {
      expect(block(agent)).toContain('Allow: /wishlist/');
      expect(block(agent)).toContain('Allow: /api/img');
    });
  }
  it('the shared page stays noindex', () => {
    expect(read(PAGE)).toMatch(/robots: \{ index: false, follow: true \}/);
  });
});

describe('shared page and the guest view: switches and budget', () => {
  it('guestWishlistPage is off in TypeScript and in the Python mirror', () => {
    expect(FEATURE_FLAGS.guestWishlistPage).toBe(false);
    expect(read('config/feature_flags.py')).toMatch(/"guest_wishlist_page":\s*False/);
  });
  it('the guest page is gated by the switch and reads no cookies or headers', () => {
    const page = read('src/app/wishlist/page.tsx');
    expect(page).toMatch(/if \(!FEATURE_FLAGS\.guestWishlistPage\) notFound\(\)/);
    expect(page).not.toMatch(/cookies\(|headers\(/);
  });
});

describe('guest wishlist view (order 1560)', () => {
  const view = read('src/components/wishlist/GuestWishlist.tsx');
  const api = read('src/app/api/guest-wishlist/route.ts');

  it('reads the hearted sets from this browser only (loadWishlist), and takes no account data', () => {
    expect(view).toMatch(/loadWishlist\(\)/);
    expect(view).not.toMatch(/document\.cookie|localStorage|sessionStorage|\/api\/account|supabase/);
  });
  it('the only network call sends the set numbers to the price route', () => {
    const calls = view.match(/fetch\(/g) ?? [];
    expect(calls).toHaveLength(1);
    expect(view).toMatch(/fetch\(`\/api\/guest-wishlist\?sets=\$\{encodeURIComponent\(key\)\}`\)/);
  });
  it('shows no rupee total and no price time', () => {
    expect(view).not.toMatch(/reduce\(|total|formatIst|best_scraped_at|toLocaleString/i);
    expect(view).not.toMatch(/₹/);
  });
  it('hides the My Collection tab: no collection tab, no collection share, no collection kind', () => {
    expect(view).not.toMatch(/tab-collection|CollectionShare|kind="collection"|My Collection/);
  });
  it('shows the empty line from the approved voice, and no price link until prices are read', () => {
    expect(view).toMatch(/VOICE\.wishlistEmpty/);
    expect(view).toMatch(/!pricesReady \? null/);
  });
  it('holds the share control with the link built by wishlistSharePath', () => {
    expect(view).toMatch(/ShareControl/);
    expect(view).toMatch(/wishlistSharePath\(numbers\)/);
  });
  it('the price route is gated by the switch, reads no cookies or headers, and returns prices only', () => {
    expect(api).toMatch(/if \(!FEATURE_FLAGS\.guestWishlistPage\) return new NextResponse\(null, \{ status: 404 \}\)/);
    expect(api).not.toMatch(/cookies\(|headers\(/);
    expect(api).toMatch(/return NextResponse\.json\(\s*\{ prices \}/);
    expect(api).not.toMatch(/best_scraped_at|scraped/);
  });
  it('the set names and pictures in the view come from the browser, not from the route', () => {
    expect(api).not.toMatch(/image_url:|name:/);
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

// Guest view wording (owner-approved 8 Nov 2026, 15:07 IST) and the count line (order 1580).
import { setCountLabel } from '../src/lib/wishlist-share';

describe('guest view wording (owner, 8 Nov 2026, 15:07 IST)', () => {
  it('the heading, the note and the metadata description are exact', () => {
    expect(SHARE_TEXT.guestWishlistHeading).toBe('My Wishlist');
    expect(SHARE_TEXT.guestWishlistNote).toBe('Saved on this device only. Clear your browser and it vanishes, like your willpower in a LEGO store.');
    expect(SHARE_TEXT.guestWishlistDescription).toBe('Your LEGO wishlist. Saved on this device, judged by nobody.');
  });
  it('the guest view and its route use the constants, and the old lines are gone', () => {
    const view = read('src/components/wishlist/GuestWishlist.tsx');
    expect(view).toMatch(/\{SHARE_TEXT\.guestWishlistHeading\}/);
    expect(view).toMatch(/\{SHARE_TEXT\.guestWishlistNote\}/);
    expect(view).not.toMatch(/Clearing your browser data clears this list/);
    expect(read('src/app/wishlist/page.tsx')).toMatch(/title: SHARE_TEXT\.guestWishlistHeading/);
    expect(read('src/app/wishlist/page.tsx')).toMatch(/description: SHARE_TEXT\.guestWishlistDescription/);
    expect(read('src/app/wishlist/page.tsx')).not.toMatch(/saved on this device\./);
  });
  it('the count line is the existing 1 set / N sets wording on both pages', () => {
    expect(setCountLabel(1)).toBe('1 set');
    expect(setCountLabel(0)).toBe('0 sets');
    expect(setCountLabel(12)).toBe('12 sets');
    expect(read('src/components/wishlist/GuestWishlist.tsx')).toMatch(/setCountLabel\(wish\.length\)/);
    expect(read(PAGE)).toMatch(/setCountLabel\(found\.length\)/);
  });
  it('the guest wishlist id is in the closed analytics tool list', () => {
    expect(SHARE_TARGET_IDS).toContain('guest-wishlist');
    expect(sanitizeParams('click_share', { page_type: 'sets_list', tool: 'guest-wishlist', channel: 'copy' }).tool).toBe('guest-wishlist');
  });
});
