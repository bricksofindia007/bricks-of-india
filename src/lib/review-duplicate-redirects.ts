// Duplicate review pairs (queue item 14, board A9). Two options are prepared; the owner picks one. Nothing imports this
// file yet, so no redirect is live. The slugs are the live review paths (GET 200 on 22 Oct 2026).

export type DuplicatePair = { set: string; keep: string; redirect: string };

/** Option A: keep the review with the price in its slug; redirect the other one to it. */
export const OPTION_A: DuplicatePair[] = [
  { set: '21373', keep: 'lego-ideas-21373-downton-abbey-worth-33600', redirect: 'lego-ideas-21373-downton-abbey-worth-the-wait' },
  { set: '21065', keep: 'lego-sagrada-famlia-21065-worth-76400', redirect: 'lego-sagrada-famlia-21065-worth-76400-2' },
];

/** Option B: keep the other review of each pair; redirect the one with the price in its slug to it. */
export const OPTION_B: DuplicatePair[] = OPTION_A.map((p) => ({ set: p.set, keep: p.redirect, redirect: p.keep }));

/** The redirect rules for the chosen option, as source and destination paths. Permanent (308) once chosen. */
export function redirectRules(option: DuplicatePair[]): { source: string; destination: string; permanent: true }[] {
  return option.map((p) => ({
    source: `/reviews/${p.redirect}`,
    destination: `/reviews/${p.keep}`,
    permanent: true as const,
  }));
}
