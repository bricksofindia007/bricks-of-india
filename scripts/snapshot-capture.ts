/**
 * Re-capture prompt snapshots from the canonical TypeScript module.
 * Run whenever VOICE_EXAMPLES or OUTPUT_FORMAT changes to bless the new baseline.
 *
 *   npx tsx scripts/snapshot-capture.ts
 *
 * After running:
 *   git add tests/snapshots/
 *   git commit -m "snapshot: re-capture after <change description>"
 */

import fs   from 'node:fs';
import path from 'node:path';
import { buildSystemPrompt, buildUserPrompt, WORD_TARGETS } from '../src/lib/prompts/draft-prompt';

const OUT = path.join(process.cwd(), 'tests', 'snapshots');

// ── Fixed deterministic fixtures — must match tests/snapshot.test.ts exactly ──

const FIXTURES = {
  news: {
    format: 'news',
    sourceTitle: 'LEGO Technic Bugatti Bolide (42151) Announced for 2026',
    sourceUrl: 'https://www.brothers-brick.com/2026/06/01/lego-technic-bugatti-bolide-42151',
    sourcePublishedAt: '2026-06-01',
    setNumber: '42151',
    fullBody: null,
    sourceExcerpt: 'LEGO has announced the new Technic Bugatti Bolide set for 2026, featuring 905 pieces.',
    indiaPriceContext: 'INDIA PRICE DATA — use these exact figures, do not calculate:\n  MyBrickHouse: ₹8,999\n  Toycra: ₹8,499',
  },
  review: {
    format: 'review',
    sourceTitle: 'LEGO Creator Expert Eiffel Tower 10307 Review',
    sourceUrl: 'https://www.jaysbrickblog.com/2026/05/lego-eiffel-tower-10307-review',
    sourcePublishedAt: '2026-05-15',
    setNumber: '10307',
    fullBody: 'The LEGO Eiffel Tower 10307 is one of the most impressive sets ever released. With 10,001 pieces and standing nearly 5 feet tall when built, it commands attention from any room.',
    sourceExcerpt: null,
    indiaPriceContext: 'INDIA PRICE DATA — use these exact figures, do not calculate:\n  MyBrickHouse: ₹65,999\n  Toycra: ₹61,500',
  },
  opinion: {
    format: 'opinion',
    sourceTitle: 'Why LEGO Icons Sets Are the Best Value in 2026',
    sourceUrl: 'https://brickset.com/article/why-lego-icons-2026',
    sourcePublishedAt: '2026-05-20',
    setNumber: null,
    fullBody: null,
    sourceExcerpt: 'LEGO Icons sets continue to dominate the collector market with excellent part-per-rupee value.',
    indiaPriceContext: 'INDIA PRICE DATA: set number could not be identified from this source. Acknowledge price uncertainty; do not state a specific figure.',
  },
} as const;

// ── Write snapshots ───────────────────────────────────────────────────────────

fs.mkdirSync(OUT, { recursive: true });

fs.writeFileSync(path.join(OUT, 'system.txt'), buildSystemPrompt(), 'utf8');
console.log('[OK] system.txt');

for (const [key, fixture] of Object.entries(FIXTURES)) {
  fs.writeFileSync(path.join(OUT, `user-${key}.txt`), buildUserPrompt(fixture), 'utf8');
  console.log(`[OK] user-${key}.txt`);
}

console.log(`\nSnapshots written to ${OUT}`);
console.log('Next: git add tests/snapshots/ && git commit -m "snapshot: re-capture after PR-2b-2 prompt hardening"');
