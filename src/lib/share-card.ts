// Share card for a collection or a wishlist: the card image and its words. Pure: no browser, no network, no storage.
// The card shows only the list name, the number of sets and the approved line. It never shows a set name, a
// rupee value, a price, a store or anything the visitor typed. The image is drawn in the visitor's own browser.

import { SHARE_TEXT } from '@/lib/share';

export type CardKind = 'collection' | 'wishlist';
export type CardFormat = 'square' | 'story';

export const CARD_SIZES: Record<CardFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

export type CardCopy = {
  kind: CardKind;
  heading: string;   // "My Collection" or "My Wishlist"
  count: string;     // "12 sets" / "1 set"
  line: string;      // the approved collection share line
  footer: string;    // the public site name only
};

const HEADINGS: Record<CardKind, string> = {
  collection: 'My Collection',
  wishlist: 'My Wishlist',
};

/** Pure: the words on the card for a list with `count` sets. The count is clamped to a whole number, zero or more. */
export function cardCopy(kind: CardKind, count: number): CardCopy {
  const n = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return {
    kind,
    heading: HEADINGS[kind],
    count: n === 1 ? '1 set' : `${n} sets`,
    line: SHARE_TEXT.collectionShared,
    footer: 'bricksofindia.com',
  };
}

/** Pure: a file name for the saved card. Names the list only, never the visitor. */
export function cardFileName(kind: CardKind, format: CardFormat): string {
  return `${kind === 'collection' ? 'my-collection' : 'my-wishlist'}-${format}.png`;
}

/** The minimal canvas surface the drawing needs. Lets the drawing be tested without a browser. */
export type CardCanvas = Pick<CanvasRenderingContext2D, 'fillStyle' | 'font' | 'textAlign' | 'fillRect' | 'fillText'>;

/** Draws the card. Layout only: the words come from cardCopy(), so the drawing adds no text of its own. */
export function drawShareCard(ctx: CardCanvas, format: CardFormat, copy: CardCopy): void {
  const { width, height } = CARD_SIZES[format];
  const mid = height / 2;
  ctx.fillStyle = '#fff7ed';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#1f2937';
  ctx.textAlign = 'center';
  ctx.font = 'bold 96px sans-serif';
  ctx.fillText(copy.heading, width / 2, mid - 120);
  ctx.font = '64px sans-serif';
  ctx.fillText(copy.count, width / 2, mid);
  ctx.font = 'italic 56px sans-serif';
  ctx.fillText(copy.line, width / 2, mid + 120);
  ctx.font = '40px sans-serif';
  ctx.fillText(copy.footer, width / 2, height - 80);
}
