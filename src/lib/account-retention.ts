// Inactive-account dates for the retention job (design in logs/evidence/2026-10-25/t2-1114-items.md, section 4).
// Pure date logic only. Nothing calls this yet: the account tables are not on main, so the job is not wired.
// Activity is a real sign-in or a change to the collection or wishlist. A click on a warning email is not activity.
// Months are calendar months in UTC, and a day past the end of a shorter month is clamped to its last day.

export const WARNING_AFTER_MONTHS = 23;
export const DELETION_AFTER_MONTHS = 24;

/** The instant `months` calendar months before `now` (UTC), with the day clamped to the end of a shorter month. */
export function monthsBefore(now: Date, months: number): Date {
  const targetMonth = now.getUTCMonth() - months;
  const firstOfTarget = new Date(Date.UTC(now.getUTCFullYear(), targetMonth, 1));
  const lastDayOfTarget = new Date(Date.UTC(firstOfTarget.getUTCFullYear(), firstOfTarget.getUTCMonth() + 1, 0)).getUTCDate();
  const day = Math.min(now.getUTCDate(), lastDayOfTarget);
  return new Date(Date.UTC(
    firstOfTarget.getUTCFullYear(),
    firstOfTarget.getUTCMonth(),
    day,
    now.getUTCHours(),
    now.getUTCMinutes(),
    now.getUTCSeconds(),
    now.getUTCMilliseconds(),
  ));
}

/** True when the account's last activity is at least `months` calendar months before `now`. */
export function inactiveFor(lastActiveAt: Date, now: Date, months: number): boolean {
  return lastActiveAt.getTime() <= monthsBefore(now, months).getTime();
}

/** The warning email is due from 23 months of inactivity until the account is deleted. The caller checks it was not sent. */
export function warningDue(lastActiveAt: Date, now: Date): boolean {
  return inactiveFor(lastActiveAt, now, WARNING_AFTER_MONTHS) && !inactiveFor(lastActiveAt, now, DELETION_AFTER_MONTHS);
}

/** The account is deleted at 24 months of inactivity. */
export function deletionDue(lastActiveAt: Date, now: Date): boolean {
  return inactiveFor(lastActiveAt, now, DELETION_AFTER_MONTHS);
}
