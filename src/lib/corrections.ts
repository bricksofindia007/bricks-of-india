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
