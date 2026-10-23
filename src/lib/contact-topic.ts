// Contact form topic. A "Privacy request" tick sends the message to the privacy mailbox instead of the general contact
// address. With the privacyRequestOption flag off, nothing changes: every message goes to the general address.
// The privacy address is used only on the server; it is never written into the page.

export const PRIVACY_EMAIL = 'privacy@bricksofindia.com';

export type Topic = 'general' | 'privacy';

/** Pure. Only the exact value 'privacy' selects the privacy topic; anything else is a general message. */
export function parseTopic(value: unknown): Topic {
  return value === 'privacy' ? 'privacy' : 'general';
}

/** Pure. The recipient for a message: the privacy mailbox only for a privacy request while the flag is on. */
export function recipientFor(topic: Topic, flagOn: boolean, generalAddress: string): string {
  return flagOn && topic === 'privacy' ? PRIVACY_EMAIL : generalAddress;
}
