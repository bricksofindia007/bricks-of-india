/** A set's theme as shown on the site: never the raw "Unknown" placeholder or a blank (3 Oct 2026). */
export function shownTheme(theme: string | null | undefined): string | null {
  const t = (theme ?? '').trim();
  return t && t.toLowerCase() !== 'unknown' ? t : null;
}
