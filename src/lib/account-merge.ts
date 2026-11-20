// First sign-in: the browser list joins the account list. Pure, so it can be tested without a database or a browser.
// Rule (order 0210 item 2): union by set number, no duplicates, the account's copy wins on a clash, and over the limit
// the newest items are kept by added_at. Nothing here writes anywhere; the caller decides what to save.
export const ACCOUNT_LIST_LIMIT = 500;

export type MergeItem = { set: string; added_at: string };

/**
 * Returns the merged list, newest first, and how many items the limit dropped.
 * An item in both lists keeps the account's copy. Duplicates inside the browser list count once.
 */
export function mergeOnSignIn<T extends MergeItem>(account: T[], browser: T[], limit: number = ACCOUNT_LIST_LIMIT): { list: T[]; dropped: number } {
  const bySet = new Map<string, T>();
  for (const item of account) bySet.set(item.set, item);
  for (const item of browser) if (!bySet.has(item.set)) bySet.set(item.set, item);
  const all = [...bySet.values()].sort((a, b) => {
    if (a.added_at !== b.added_at) return a.added_at < b.added_at ? 1 : -1;
    return a.set < b.set ? -1 : a.set > b.set ? 1 : 0;
  });
  const list = all.slice(0, limit);
  return { list, dropped: all.length - list.length };
}
