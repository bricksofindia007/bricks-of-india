// Instagram heartbeat window. Posts go out on Mondays only, so a run or a
// successful post is expected about once a week. The health check alerts only
// after 8 days with none.
export const IG_HEARTBEAT_WINDOW_HOURS = 192;

// Exactly at the limit is not past it.
export function isPastWindow(ageHours, windowHours = IG_HEARTBEAT_WINDOW_HOURS) {
  return ageHours > windowHours;
}
