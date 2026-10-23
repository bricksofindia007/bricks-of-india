// Approved public wording for the age rule and the account deletion pages (owner approval, 23 Oct 2026, 09:29 IST).
// Used exactly as approved (R1). Text in square brackets is still waiting for the owner's values: the pages must not
// be switched on while any bracketed text remains (see placeholdersIn and tests/legal-approved-copy.test.ts).

export const AGE_RULE_COPY = {
  heading: 'Accounts are for grown-ups (18+)',
  body: 'LEGO is for everyone. Collecting your sets and wishes in an account is for people aged 18 and over, because India’s data protection rules treat under-18s’ information very carefully. Under 18? You still get everything that matters: every price, every comparison, every review, no account needed. Your wallet and your parents will both thank you.',
  signUpCheckbox: 'I’m 18 or older.',
} as const;

export const DELETION_COPY = {
  heading: 'Delete your BOI account',
  body: 'Changed your mind? No hard feelings, and no guilt trips. We keep it quick. What gets deleted: your account, your Collection, your Wishlist, your price alerts, and your email address from our sign-in records. How: sign in, open My BOI, choose Delete my account, and confirm with the code we email you. Done within [TIMELINE TO CONFIRM] days. Can’t sign in? Email us at [CONTACT ADDRESS TO CONFIRM] from the address on the account and we’ll sort it. Backups: our encrypted backups are overwritten on their normal schedule, so a copy can sit in an old backup for up to [BACKUP RETENTION TO CONFIRM] before it disappears. Newsletter only? The unsubscribe link in any email takes you off the list straight away.',
} as const;

/** Pure. The bracketed fields still in a piece of text, in order. */
export function placeholdersIn(text: string): string[] {
  return text.match(/\[[^\]]*\]/g) ?? [];
}

/**
 * Pure. What blocks a page from going on: any bracketed text while its flag is on. With the flag off nothing is
 * shown to visitors, so nothing blocks.
 */
export function publishBlockers(texts: string[], flagOn: boolean): string[] {
  if (!flagOn) return [];
  return texts.flatMap((t) => placeholdersIn(t));
}
