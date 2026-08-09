'use strict';
/**
 * Guides weekly topic backlog (§5, Nav & Content Overhaul, 2026-08-09).
 *
 * Guides aren't sourced from an external article the way News/Review/
 * Opinion are — they're evergreen advice pieces. This is the queue
 * queue-weekly-guide.js works through, one topic per week, in array order.
 * Checked against every existing guides/blog_posts title live before
 * writing this list (2026-08-09) — none of these duplicate existing
 * coverage. queue-weekly-guide.js re-checks against live guides.title at
 * runtime too, so this list can safely be edited/reordered/extended later
 * without risking a duplicate — the runtime check is the real guardrail,
 * this list is just supply.
 *
 * category must be one of the 5 real values /guides' filter chips use
 * (src/app/guides/page.tsx GUIDE_CATEGORIES): lego-101, Buying Guides,
 * How-To, Gift Guides, Value Picks.
 *
 * brief is NOT shown to readers — it's the synthetic source_excerpt fed to
 * the model in place of a real fetched article body (see
 * buildIndiaPriceContext-adjacent handling in generate-approved-drafts.ts,
 * which already tolerates a null/short fetch gracefully for any format).
 */
module.exports = [
  // ── age-based ──────────────────────────────────────────────────────────
  { slug: 'lego-duplo-vs-classic-toddlers-india', bucket: 'age-based', category: 'Buying Guides',
    title: 'LEGO Duplo vs LEGO Classic — What’s Right for Toddlers in India?',
    brief: 'Compare Duplo and Classic for very young kids (under 5) in an Indian context — safety, price, durability, what actually survives a joint family living room.' },
  { slug: 'best-lego-sets-teenagers-india', bucket: 'age-based', category: 'Gift Guides',
    title: 'Best LEGO Sets for Teenagers in India (2026)',
    brief: 'Sets that land well for 13-17 year olds in India specifically — Technic, Speed Champions, Icons — not toddler-coded, not so complex it becomes a chore.' },

  // ── budget-based ───────────────────────────────────────────────────────
  { slug: 'best-lego-sets-under-1000-india', bucket: 'budget-based', category: 'Buying Guides',
    title: 'Best LEGO Sets Under ₹1,000 in India (2026)',
    brief: 'What genuinely holds up at the very low end of LEGO pricing in India right now — polybags, small Creator sets, CMF figures.' },
  { slug: 'best-lego-sets-under-10000-india', bucket: 'budget-based', category: 'Buying Guides',
    title: 'Best LEGO Sets Under ₹10,000 in India (2026)',
    brief: 'The serious-hobbyist budget tier — mid-size Technic, Icons, Star Wars UCS-adjacent sets that are real purchases, not impulse buys.' },
  { slug: 'lego-on-emi-is-it-worth-it-india', bucket: 'budget-based', category: 'Value Picks',
    title: 'LEGO on an EMI Budget — Is It Worth It in India?',
    brief: 'Honest take on financing a LEGO purchase via card EMI in India — when it makes sense, when it’s a trap, real interest-cost math.' },

  // ── theme-based ────────────────────────────────────────────────────────
  { slug: 'best-lego-harry-potter-sets-india', bucket: 'theme-based', category: 'Buying Guides',
    title: 'Best LEGO Harry Potter Sets Available in India (2026)',
    brief: 'Which Harry Potter sets are actually stocked/importable in India right now, and which are worth the price vs. just being fan-service.' },
  { slug: 'best-lego-icons-sets-display-india', bucket: 'theme-based', category: 'Buying Guides',
    title: 'Best LEGO Icons Sets for Display in India (2026)',
    brief: 'Icons sets that look good as permanent display pieces in a typical Indian home/apartment — size, dust, shelf-space realism.' },
  { slug: 'best-lego-marvel-sets-india', bucket: 'theme-based', category: 'Buying Guides',
    title: 'Best LEGO Marvel Sets You Can Buy in India Right Now (2026)',
    brief: 'Currently-available Marvel sets in India, price vs. minifig-count value, which ones are worth it vs. overpriced for the IP.' },
  { slug: 'best-lego-botanical-sets-home-decor-india', bucket: 'theme-based', category: 'Buying Guides',
    title: 'Best LEGO Botanical Sets for Home Decor in India (2026)',
    brief: 'Botanicals as home decor for Indian apartments — which ones actually look good on a shelf/console table, price-to-visual-impact.' },
  { slug: 'best-lego-speed-champions-sets-india', bucket: 'theme-based', category: 'Buying Guides',
    title: 'Best LEGO Speed Champions Sets in India (2026)',
    brief: 'Speed Champions sets available in India, good entry point for car-enthusiast LEGO fans, price vs. piece count reality check.' },

  // ── storage / display ──────────────────────────────────────────────────
  { slug: 'lego-display-shelf-budget-india', bucket: 'storage-display', category: 'How-To',
    title: 'How to Build a LEGO Display Shelf on a Budget in India',
    brief: 'Practical, cheap shelving/display options sourced in India (not imported organizer products) for a growing LEGO collection.' },
  { slug: 'protect-lego-collection-humidity-india', bucket: 'storage-display', category: 'How-To',
    title: 'How to Protect Your LEGO Collection From Indian Humidity',
    brief: 'Real problem for Indian collectors — yellowing, sticker peeling, brick warping in monsoon-humidity cities. Practical prevention.' },
  { slug: 'organize-loose-lego-pieces-sorting-system', bucket: 'storage-display', category: 'How-To',
    title: 'How to Organize Loose LEGO Pieces — A Sorting System That Works',
    brief: 'A practical sorting system for loose parts (by color/type/set) that doesn’t require expensive imported storage systems.' },

  // ── gift-occasion ──────────────────────────────────────────────────────
  { slug: 'best-lego-sets-diwali-gifting-india', bucket: 'gift-occasion', category: 'Gift Guides',
    title: 'Best LEGO Sets for Diwali Gifting in India (2026)',
    brief: 'LEGO as a Diwali gift for kids/relatives in India — price tiers, what reads as a thoughtful gift vs. an afterthought.' },
  { slug: 'best-lego-birthday-gift-under-3000-india', bucket: 'gift-occasion', category: 'Gift Guides',
    title: 'Best LEGO Sets for a Birthday Gift Under ₹3,000 (2026)',
    brief: 'The most common Indian gifting budget bracket for a kid’s birthday — what actually feels like a real gift at this price.' },
  { slug: 'best-lego-rakhi-sibling-gifting-india', bucket: 'gift-occasion', category: 'Gift Guides',
    title: 'Best LEGO Sets for Rakhi and Sibling Gifting in India (2026)',
    brief: 'LEGO sets that work as a Rakhi/sibling gift across a wide age range — practical Indian-festival-specific gifting guide.' },
  { slug: 'best-lego-anniversary-couple-gift-sets-india', bucket: 'gift-occasion', category: 'Gift Guides',
    title: 'Best LEGO Anniversary and Couple Gift Sets in India (2026)',
    brief: 'LEGO as an adult/couple gift for anniversaries in India — Icons, Botanicals, display-focused sets, not kid-coded.' },

  // ── general lego-101 ───────────────────────────────────────────────────
  { slug: 'lego-piece-count-vs-price-india', bucket: 'lego-101', category: 'lego-101',
    title: 'LEGO Piece Count vs Price — What You’re Actually Paying For',
    brief: 'Explains price-per-piece as a (imperfect) value metric for Indian buyers, when it’s misleading (licensed IP, small detailed parts).' },
  { slug: 'lego-instructions-only-vs-box-india', bucket: 'lego-101', category: 'lego-101',
    title: 'Should You Buy LEGO Instructions-Only or Always Get the Box? A Guide for India',
    brief: 'Instructions-only/bricks-only marketplace buying in India — legitimacy, resale value, when it’s a smart saving vs. a bad idea.' },
  { slug: 'lego-minifigure-collecting-101-india', bucket: 'lego-101', category: 'lego-101',
    title: 'LEGO Minifigure Collecting 101 for Indian Fans',
    brief: 'Getting started collecting minifigures/CMF as an Indian fan — where to buy, blind-bag economics, what’s realistic vs. import-only.' },
];
