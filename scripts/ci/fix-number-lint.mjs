// Fix numbering (order 1130, addendum 23:31 item I): a data-fix file's number is its GitHub issue, and only that.
// A number used by a second file is a failure, except the numbers that were already shared before this rule.
// Pure: no network, no database. The lint is not wired into CI yet (a workflow change for a separate decision).

// Numbers used by more than one file in supabase/data-fixes/ on 27 Oct 2026. Kept as they are (renaming an applied
// fix would make the runner's ledger see it as new). No new number may join this list.
export const LEGACY_SHARED_NUMBERS = new Set([
  '17', '165', '176', '246', '339', '422', '455', '457', '471', '498', '540', '563', '625',
]);

/** The fix number of a file name such as "798-review-price-pointer-seven.sql". Null when the name has no number. */
export function fixNumber(name) {
  const m = /^(\d+)-/.exec(name);
  return m ? m[1] : null;
}

/** The numbers that more than one file uses, excluding the legacy list. Empty means the rule holds. */
export function newDuplicateFixNumbers(names) {
  const count = new Map();
  for (const n of names) {
    const num = fixNumber(n);
    if (num === null) continue;
    count.set(num, (count.get(num) ?? 0) + 1);
  }
  return [...count.entries()]
    .filter(([num, c]) => c > 1 && !LEGACY_SHARED_NUMBERS.has(num))
    .map(([num]) => num)
    .sort((a, b) => Number(a) - Number(b));
}
