// The default order of /sets: sets with an in-stock price first, newest first within each group.
// Pure, so the page only slices the result. The rows come from the hourly cached skeleton (set number, year, theme).

export type SetOrderRow = { set_number: string; year: number | null; theme: string | null };

export function orderSetsForDefault(
  rows: SetOrderRow[],
  hasPrice: (setNumber: string) => boolean,
  themeFilter: string,
): string[] {
  const scoped = themeFilter ? rows.filter((r) => r.theme === themeFilter) : rows;
  return [
    ...scoped.filter((r) => hasPrice(r.set_number)),
    ...scoped.filter((r) => !hasPrice(r.set_number)),
  ].map((r) => r.set_number);
}
