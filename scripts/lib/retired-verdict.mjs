// A5 (P14 round 7, #459): retirement-check rewrites the Verdict / Standard disclaimer lines of a
// review whose set LEGO has retired. The retired flag says nothing about Indian stock, so these
// lines must never claim the set is unavailable (17 published pages were wrong on 1 Oct 2026:
// every one of those sets was on sale in India). Wording approved by chat, 1 Oct 2026.
export const NEW_VERDICT_LINE =
  "Verdict: RETIRED. LEGO has discontinued this set, but Indian stores may still have stock; check the live price page before assuming it's gone.";
export const NEW_DISCLAIMER_LINE =
  "Standard disclaimer: this set is retired by LEGO; check the live price page before assuming it's gone. If Indian stores sell out, the secondary market is the remaining option.";

/** Availability claims the retired flag can never support. */
export const AVAILABILITY_CLAIM = /no longer (available|sold|on sale)|not available|nothing left to buy|sold out everywhere|can(?:no|')t (be )?(buy|bought|find)/i;

export function fixContent(content) {
  let out = content.replace(/^Verdict:.*$/gm, NEW_VERDICT_LINE);
  out = out.replace(/^Standard disclaimer:.*$/gm, NEW_DISCLAIMER_LINE);
  return out;
}

// Fail loudly if anyone edits the lines above into an availability claim.
for (const l of [NEW_VERDICT_LINE, NEW_DISCLAIMER_LINE]) {
  if (AVAILABILITY_CLAIM.test(l)) throw new Error(`retired-verdict: line makes an availability claim: ${l}`);
}
