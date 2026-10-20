// Keyboard movement between the My Collection tabs, as the tab pattern describes: Left and Right move between tabs
// and wrap at the ends; Home and End go to the first and the last tab. Any other key moves nothing.
export type CollectionTab = 'wish' | 'owned';

const ORDER: CollectionTab[] = ['wish', 'owned'];

/** The tab an arrow, Home or End key moves to, or null for any other key. */
export function nextTab(current: CollectionTab, key: string): CollectionTab | null {
  const i = ORDER.indexOf(current);
  if (key === 'ArrowRight') return ORDER[(i + 1) % ORDER.length];
  if (key === 'ArrowLeft') return ORDER[(i - 1 + ORDER.length) % ORDER.length];
  if (key === 'Home') return ORDER[0];
  if (key === 'End') return ORDER[ORDER.length - 1];
  return null;
}
