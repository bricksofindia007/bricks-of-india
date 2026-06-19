export type DraftRow = {
  source_excerpt?: string | null;
};

// Layer 2 rule (locked): Cerebras failover only when excerpt is long enough to ground the generation.
// Covers no_excerpt (46% of approved backlog) and YouTube (5%) — Cerebras only sees the proven-safe 49%.
export function isCerebrasEligible(draft: DraftRow): boolean {
  const excerpt = draft.source_excerpt ?? '';
  return excerpt.length >= 200;
}
