// G19 (CLAUDE.md, 1 Oct 2026): the shared term list catches method talk and leaves ordinary LEGO writing alone.
import { describe, it, expect } from 'vitest';
import { g19Hits } from '../src/lib/g19';

describe('G19 term list', () => {
  it.each([
    'Our prices are scraped every 6 hours from actual retailer websites.',
    'Prices updated every 6 hours.',
    'Scrapers run every 6 hours — check back later.',
    'MRP = MyBrickHouse\'s listed MRP, else Toycra\'s, else the verified LEGO India MRP',
    'Prices scraped daily from Toycra and MyBrickHouse official Shopify APIs',
    'This article was AI-generated.',
    'Written by Gemini with a quality gate.',
    'The bot reads products.json.',
    'Crawl-delay is advisory only; no rate-limiting rule enforces it.',
    'Data comes from our pipeline on GitHub Actions and Supabase.',
  ])('flags: %s', (s) => { expect(g19Hits(s).length).toBeGreaterThan(0); });

  it.each([
    'Toycra has it at ₹40,399 and lego.in at ₹50,399.',
    'Updated 3 hours ago',
    'The Technic gearbox has an automatic mode and a manual override.',
    'That is enough to feed a family of four for a month.',
    'Spider-Man swings into the Daily Bugle again.',
    'BricksOfIndiaBot belongs to Bricks of India.',
    'Questions or requests: bot [at] bricksofindia [dot] com.',
    'The robot comes with 3 minifigures.',
  ])('allows: %s', (s) => { expect(g19Hits(s)).toEqual([]); });
});
