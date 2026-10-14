// 3 Oct 2026: articles with a store price typed into the text show when that price was written,
// plus a link to today's prices. Render-time only; the article text itself is not changed.
const TYPED_STORE_PRICE = /(?:LEGO\.in|Toycra)[^.\n]{0,80}₹\s?\d|₹\s?\d[\d,]*[^.\n]{0,40}\b(?:at|on|from)\s+(?:LEGO\.in|Toycra)/;

export function hasTypedStorePrice(content: string | null | undefined): boolean {
  return TYPED_STORE_PRICE.test(content ?? '');
}
