// Deadlines for the morning brief (order 1430 item 7). The list lives in config/brief-deadlines.json: one row per real
// date, with a label. Nothing here is hard-coded.
import fs from 'node:fs';

/** Reads the deadline list from a JSON file (array of { label, date: 'YYYY-MM-DD' }). */
export function loadDeadlines(fileUrl) {
  const rows = JSON.parse(fs.readFileSync(fileUrl, 'utf8'));
  if (!Array.isArray(rows)) throw new Error('brief deadlines file must hold an array');
  for (const r of rows) {
    if (typeof r.label !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date)) {
      throw new Error(`brief deadline row is malformed: ${JSON.stringify(r)}`);
    }
  }
  return rows;
}

/** Pure. The nearest deadline still in the future, with days left; null when none is left. */
export function nextDeadlineFrom(deadlines, nowMs) {
  return deadlines
    .map((d) => ({ ...d, daysLeft: (new Date(d.date).getTime() - nowMs) / 86_400_000 }))
    .filter((d) => d.daysLeft > 0)
    .sort((a, b) => a.daysLeft - b.daysLeft)[0] ?? null;
}
