// Window for the Instagram heartbeat checks. A check alerts only after the
// window has passed with no run or no successful post.
export const IG_HEARTBEAT_WINDOW_HOURS = 192;

// Exactly at the limit is not past it.
export function isPastWindow(ageHours, windowHours = IG_HEARTBEAT_WINDOW_HOURS) {
  return ageHours > windowHours;
}
