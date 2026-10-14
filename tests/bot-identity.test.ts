import { describe, it, expect } from 'vitest';
import { BOT_UA, BOT_PACE_MS } from '../src/lib/bot-identity';
import { BOT_UA as CONTRACT_UA, PACE_MS } from '../scripts/lib/scraper-contract.mjs';

describe('FP5.10 bot identity', () => {
  it('/bot shows exactly the user agent and pacing the scrapers use (G11)', () => {
    expect(BOT_UA).toBe(CONTRACT_UA);
    expect(BOT_PACE_MS).toBe(PACE_MS);
    expect(BOT_UA).toContain('https://bricksofindia.com/bot');
  });
});
