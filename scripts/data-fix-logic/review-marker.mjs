// Marker B for review text (decision #5, order 1580 item 3). This is the same rule as the UPDATE in
// supabase/data-fixes/563-review-text-fixes-2026-11-08.sql, written in JavaScript so the rule can be tested:
// paragraphs are split on a blank line (never on sentences, so "Mrs." does not matter); the marker goes in as its
// own paragraph directly after the first paragraph that holds a rupee figure; a text that already has the marker is unchanged.
// Pure: no database, no network.

export const MARKER =
  "*Prices move faster than a minifig loses its hat. The figure here is from when we wrote this. We check prices daily, so the set page has today's.*";

const RUPEE_FIGURE = /₹\s?[0-9]/;

/** Returns the text with the marker inserted once, or the text unchanged when there is no rupee figure or the marker is present. */
export function insertMarker(content) {
  if (content.includes(MARKER)) return content;
  const paragraphs = content.split('\n\n');
  const idx = paragraphs.findIndex((p) => RUPEE_FIGURE.test(p));
  if (idx < 0) return content;
  return [...paragraphs.slice(0, idx + 1), MARKER, ...paragraphs.slice(idx + 1)].join('\n\n');
}
