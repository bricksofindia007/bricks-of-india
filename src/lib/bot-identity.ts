// FP5.10 bot identity, shown on /bot. MUST equal scripts/lib/scraper-contract.mjs
// (BOT_UA, PACE_MS); tests/bot-identity.test.ts fails if they drift apart (G11: honest
// wording comes from the same values the scrapers actually use).
export const BOT_UA = 'BricksOfIndiaBot/1.0 (+https://bricksofindia.com/bot; bot@bricksofindia.com)';
export const BOT_PACE_MS = 3000;
export const BOT_CONTACT = 'bot@bricksofindia.com';
