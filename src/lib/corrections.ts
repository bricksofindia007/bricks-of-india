// Public corrections page (FP7.6, 3 Oct 2026): pull the dated correction notes out of article text.
// Formats in use: "Correction (26 Sep 2026): …", "*Correction, 1 Oct 2026: …*", "Corrected 29 Sep 2026, updated 30 Sep 2026: …",
// "Updated 1 Oct 2026: …". Pure functions, so they're unit-tested.

export type CorrectionNote = { date: string; text: string };

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const NOTE = /^[*_\s]*(?:Correction|Corrected|Updated|Update)\b[\s,(]*(\d{1,2}) ([A-Za-z]{3,9}) (\d{4})\)?[^:\n]*:\s*([^\n]+?)[*_\s]*$/gim;

/** Every dated note in a piece of article text, as { date: YYYY-MM-DD, text }. */
export function extractCorrections(content: string | null | undefined): CorrectionNote[] {
  const out: CorrectionNote[] = [];
  for (const m of (content ?? '').matchAll(NOTE)) {
    const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (month === undefined) continue;
    const date = new Date(Date.UTC(Number(m[3]), month, Number(m[1]))).toISOString().slice(0, 10);
    out.push({ date, text: m[4].trim() });
  }
  return out;
}

/** The one site-wide note repeated on hundreds of pages (the store's new name) is shown once, with a count. */
export const STORE_RENAME_NOTE = /MyBrickHouse's online store is now LEGO\.in/i;

/** A note as display parts: plain text and internal markdown links ("[label](/path)"), first letter capitalised. */
export type NotePart = { text: string; href?: string };
const MD_LINK = /\[([^\]]+)\]\((\/[^)\s]*)\)/g;
export function noteParts(text: string): NotePart[] {
  const parts: NotePart[] = [];
  let last = 0;
  for (const m of text.matchAll(MD_LINK)) {
    if (m.index! > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ text: m[1], href: m[2] });
    last = m.index! + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  if (parts.length && !parts[0].href) parts[0] = { text: parts[0].text.charAt(0).toUpperCase() + parts[0].text.slice(1) };
  return parts;
}

/** Notes that are the same apart from their set link are shown once per date, with every page still listed. */
export const groupKey = (date: string, text: string) => `${date}|${text.replace(MD_LINK, '').replace(/\s+/g, ' ').trim().toLowerCase()}`;
export function groupLabel(text: string, n: number): string {
  if (/estimated price removed/i.test(text)) return `Removed unverified price estimates from ${n} articles.`;
  if (/no longer available in India|retired and unavailable in India/i.test(text)) return `Corrected ${n} reviews that wrongly said the set couldn't be bought in India.`;
  if (/which store the price below comes from/i.test(text)) return `Corrected which store a price came from on ${n} reviews.`;  // round 11 (chat, 4 Oct 2026)
  const plain = text.replace(MD_LINK, '$1').trim();
  return `${plain.charAt(0).toUpperCase()}${plain.slice(1)} (${n} pages)`;
}
export const GROUP_MIN = 3;
