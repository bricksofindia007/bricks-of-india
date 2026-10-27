// The wishlist price line, as rendered. If a store name can't be read, the row shows the neutral line and never a store ID.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { WishPrice } from '../src/app/my/PriceNotes';
import { VOICE } from '../src/lib/my-collection';

const text = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#x27;/g, "'");
const NAMES = { lego_in: 'LEGO.in', toycra: 'Toycra' };

describe('the wishlist price line, as rendered', () => {
  it('a price with its store names shows both, with the store names and no ID', () => {
    const html = renderToStaticMarkup(<WishPrice priceReady={true} price={41199} storeIds={['lego_in']} storeNames={NAMES} />);
    expect(text(html)).toBe('₹41,199 at LEGO.in');
    expect(html).not.toContain('lego_in');
  });
  it('a price with several stores lists each name', () => {
    const html = renderToStaticMarkup(<WishPrice priceReady={true} price={41199} storeIds={['lego_in', 'toycra']} storeNames={NAMES} />);
    expect(text(html)).toBe('₹41,199 at LEGO.in, Toycra');
  });
  it('the store lookup fails (no names): the neutral line, never the store ID', () => {
    const html = renderToStaticMarkup(<WishPrice priceReady={true} price={41199} storeIds={['lego_in']} storeNames={{}} />);
    expect(text(html)).toBe(VOICE.pricesUnavailable);
    expect(html).not.toContain('lego_in');
    expect(html).not.toContain('41,199');
  });
  it('one store name is missing: the neutral line, and the known name is not shown alone', () => {
    const html = renderToStaticMarkup(<WishPrice priceReady={true} price={41199} storeIds={['lego_in', 'toycra']} storeNames={{ lego_in: 'LEGO.in' }} />);
    expect(text(html)).toBe(VOICE.pricesUnavailable);
    expect(html).not.toContain('toycra');
  });
  it('no price: "No Indian price yet. We\'re watching the shelves.", as before', () => {
    const html = renderToStaticMarkup(<WishPrice priceReady={true} price={null} storeIds={null} storeNames={{}} />);
    expect(text(html)).toBe('No Indian price yet. We\'re watching the shelves.');
  });
  it('a price with no store recorded shows the price alone', () => {
    const html = renderToStaticMarkup(<WishPrice priceReady={true} price={41199} storeIds={null} storeNames={{}} />);
    expect(text(html)).toBe('₹41,199');
  });
  it('while the read is pending, nothing is shown', () => {
    expect(renderToStaticMarkup(<WishPrice priceReady={false} price={41199} storeIds={['lego_in']} storeNames={NAMES} />)).toBe('');
  });
});
