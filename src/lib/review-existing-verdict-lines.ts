// Standard line for the four existing reviews whose verdict is IMPORT ONLY or HUNT IT.
// Used only by the data fix supabase/data-fixes/a1-import-hunt-disclaimer.sql (which writes the
// text into the stored review). It is NOT a publish path: publishing still rejects these
// verdicts (see review-disclaimer.ts and its tests). Wording approved by the owner, option B.

export const EXISTING_REVIEW_VERDICT_LINES = {
  'IMPORT ONLY':
    "Standard disclaimer: if you're rich, you can import it and skip the wait. The rest of us will be here checking whether an Indian store ever stocks it, and doing the sums first. If you're determined enough to import this one, do the maths on freight and customs first.",
  'HUNT IT':
    "Standard disclaimer: if you're rich, you can skip the hunt and just buy it. The rest of us will be out looking for a better deal before we check out.",
} as const;

export type ExistingVerdict = keyof typeof EXISTING_REVIEW_VERDICT_LINES;
