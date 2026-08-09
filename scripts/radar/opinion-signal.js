'use strict';
/**
 * Opinion-shaped title signal — shared by scripts/radar/opinion-cadence.js.
 *
 * Extracted from classify-signals.js's old classifyFormat() (Nav & Content
 * Overhaul, 2026-08-09). Previously this regex could independently set
 * draft_format='opinion' on ANY day, for ANY matching signal — that's how
 * all pre-overhaul Opinion pieces got made, at an uncontrolled, reactive
 * rate. Opinion cadence is now a deterministic fortnightly branch
 * (opinion-cadence.js) — this regex no longer has the power to produce an
 * Opinion piece on its own. It survives only as a SAME-DAY RANKING
 * PREFERENCE among that day's already-qualified News candidates on an
 * Opinion day: "does this one already have a natural hot-take angle,
 * rather than being a plain announcement" — genuinely useful signal,
 * worth keeping, just demoted from trigger to tie-breaker (Abhinav,
 * 2026-08-09).
 */
const OPINION_RE = /\b(opinion|editorial|why|should you|is it worth|best|worst|top \d|ranked|ranking|vs\.?|versus|compar(ed?|ing)|argument)\b/i;

function looksLikeOpinion(title) {
  return OPINION_RE.test((title || '').toLowerCase());
}

module.exports = { OPINION_RE, looksLikeOpinion };
