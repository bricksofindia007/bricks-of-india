// Key events for GA4, in one place. Each one is sent only when the keyEvents flag is on.
// The events are allowlisted in src/lib/analytics.ts; this module is the only caller of the new ones.
// No personal data: a page type, a set number, a closed source tag. Failure behaviour: a missing GA script
// or a flag that is off means nothing is sent and the page is unaffected.
import { trackEvent } from '@/lib/analytics';
import { FEATURE_FLAGS } from '@/lib/feature-flags';

export const KEY_EVENTS = [
  'sign_up',
  'add_to_collection',
  'add_to_wishlist',
  'alert_set',
  'click_store_listing', // outbound store click: already sent by the store links; listed here so the set is in one place
  'standee_visit',
] as const;
export type KeyEvent = (typeof KEY_EVENTS)[number];

/** Send one key event if the flag is on. Returns whether a send was attempted. */
export function trackKeyEvent(name: KeyEvent, params: Record<string, unknown> = {}): boolean {
  if (!FEATURE_FLAGS.keyEvents) return false;
  if (!(KEY_EVENTS as readonly string[]).includes(name)) return false;
  // click_store_listing is sent by its own link code; it is not re-sent here.
  if (name === 'click_store_listing') return false;
  trackEvent(name, params);
  return true;
}
