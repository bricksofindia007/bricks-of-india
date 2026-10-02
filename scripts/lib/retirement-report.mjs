// Item 0 (P14 round 8): what the weekly retirement check may say about a
// review, given the set's India status (src/lib/india-status.ts). It never
// rewrites content and never sets a verdict: "Retired" is never a review
// verdict (verdicts are buying calls), and availability wording follows the
// India status only. Findings go to content_quality_issues for a person.

// Claims about THIS set's availability. Narrow on purpose: a review may
// mention a different, retired set ("a step down from the retired 10214").
const OWN_AVAILABILITY_CLAIM = new RegExp(
  [
    String.raw`^Verdict:\s*RETIRED`,
    String.raw`^Standard disclaimer:.*\bretired\b`,
    String.raw`\bthis set (has been|is|was) (retired|discontinued)`,
    String.raw`\bno longer (available|sold|on sale)\b`,
    String.raw`\bnothing left to buy\b`,
  ].join('|'),
  'im',
);

/**
 * @param {{ verdict: string | null, content: string | null }} review
 * @param {import('../../src/lib/india-status').IndiaStatus} status
 * @returns {{ check: string, detail: string }[]}
 */
export function reviewAvailabilityFindings(review, status) {
  const out = [];
  if ((review.verdict || '').trim().toUpperCase() === 'RETIRED') {
    out.push({
      check: 'retired_verdict_needs_buying_call',
      detail: `Verdict is RETIRED; verdicts must be buying calls (Buy / Wait / Skip). India status: ${status.kind}.`,
    });
  }
  const v = (review.verdict || '').trim().toUpperCase();
  if (v === 'HUNT IT' && status.kind !== 'retired') {
    out.push({
      check: 'hunt_it_on_set_sold_in_india',
      detail: `Verdict is HUNT IT (only second-hand), but India status is ${status.kind}; it needs a new buying call.`,
    });
  }
  if (status.kind !== 'retired' && OWN_AVAILABILITY_CLAIM.test(review.content || '')) {
    out.push({
      check: 'retired_wording_on_set_sold_in_india',
      detail: `Text calls the set retired or unavailable, but India status is ${status.kind}.`,
    });
  }
  return out;
}
