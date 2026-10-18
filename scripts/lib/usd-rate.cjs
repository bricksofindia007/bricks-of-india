// USD to INR rate decision for the MRP estimate job (decision of 18 Oct 2026; design doc in boi-ops PR 51).
// One stored rate with its date. No fixed fallback anywhere. Pure functions: no network, no database.
const BAND_MIN = 70;          // rupees per dollar; a value outside the band is rejected
const BAND_MAX = 110;
const JUMP_MAX = 0.05;        // a new value more than 5% from the stored value is rejected
const STALE_DAYS = 5;         // a stored value older than this is not used

const DAY_MS = 24 * 3600 * 1000;

function inBand(rate) {
  return typeof rate === 'number' && Number.isFinite(rate) && rate >= BAND_MIN && rate <= BAND_MAX;
}

function passesJump(rate, stored) {
  if (!stored) return true;
  return Math.abs(rate - stored.rate) / stored.rate <= JUMP_MAX;
}

function ageDays(storedDate, today) {
  return (Date.parse(today) - Date.parse(storedDate)) / DAY_MS;
}

// fetched: a number from this run, or null when the fetch failed.
// stored:  { rate, date } from the stored row, or null when there is none.
// today:   ISO date string of this run.
// Returns { rate, source, alert, storeNew }. rate is null when no dependent write may happen.
function resolveRate({ fetched, stored, today }) {
  if (inBand(fetched) && passesJump(fetched, stored)) {
    return { rate: fetched, source: 'fetched', alert: null, storeNew: true };
  }
  const why = inBand(fetched) ? 'fetched value failed the 5% jump check' : 'fetch failed or value outside 70 to 110';
  if (stored && ageDays(stored.date, today) <= STALE_DAYS) {
    return { rate: stored.rate, source: 'stored', alert: `${why}; using stored rate from ${stored.date}`, storeNew: false };
  }
  const age = stored ? `${Math.floor(ageDays(stored.date, today))} days old` : 'missing';
  return { rate: null, source: 'none', alert: `${why}; stored rate is ${age} (limit ${STALE_DAYS} days); dependent writes skipped`, storeNew: false };
}

module.exports = { BAND_MIN, BAND_MAX, JUMP_MAX, STALE_DAYS, inBand, passesJump, resolveRate };
