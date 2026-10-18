// Daily volume from a cumulative count. Each reading is the running total since the counter last reset.
// The day's volume is the change between consecutive readings. A decrease means the counter was reset
// (its statistics were cleared), so the new reading is the volume since the reset, never a negative number.

/**
 * readings: [{ at: ISO timestamp, count: number }] in any order.
 * Returns [{ day: 'YYYY-MM-DD', volume: number }], one row per day that has a reading after an earlier one.
 * The first reading of the series has no earlier reading to compare with, so it adds no volume.
 */
export function dailyVolume(readings) {
  const sorted = [...readings].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const perDay = new Map();
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    const volume = next.count >= prev.count ? next.count - prev.count : next.count; // reset: count since the reset
    const day = next.at.slice(0, 10);
    perDay.set(day, (perDay.get(day) ?? 0) + volume);
  }
  return [...perDay.entries()].map(([day, volume]) => ({ day, volume })).sort((a, b) => a.day.localeCompare(b.day));
}
