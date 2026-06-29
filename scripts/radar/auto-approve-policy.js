'use strict';
/**
 * RADAR-03 auto-approve policy (2026-06-29, Abhinav, explicit instruction).
 *
 * "I want a system that automates it... I don't want manual dependency
 * anywhere... do not auto select reddit or youtube videos."
 *
 * Tier 1/2 sources (config/sources.json: 4 editorial outlets — Brothers
 * Brick, Jay's Brick Blog, New Elementary, BrickNerd; 3 official/catalogue —
 * Brickset, Rebrickable, LEGO.com) are curated, edited publications, not
 * anonymous user-generated content. They skip the human "Approve signal"
 * click in /admin/pending entirely and go straight into the generator queue.
 *
 * Tier 3 (r/lego), Tier 4 (YouTube channels), Tier 5 (topic-only outlets)
 * are explicitly UNCHANGED — still require manual approval, per Abhinav's
 * direct instruction not to auto-select Reddit or YouTube.
 *
 * This module makes ONLY the topic-selection decision (should a human have
 * to approve this signal before it can be drafted). It does not touch, and
 * has no bearing on, any of the downstream quality gates (factuality,
 * source fidelity, voice/tone Gate 7, the auto-publish-vs-reject-delete
 * decision in src/lib/auto-publish-gate.ts) — those run identically on every
 * draft regardless of which tier it came from or whether a human or this
 * policy approved the underlying signal.
 */

const AUTO_APPROVE_TIERS = new Set([1, 2]);

/**
 * @param {number} sourceTier - the raw_signals.source_tier value (1-5)
 * @returns {boolean} true if this tier should skip manual signal approval
 */
function isAutoApproveTier(sourceTier) {
  return AUTO_APPROVE_TIERS.has(sourceTier);
}

module.exports = { isAutoApproveTier, AUTO_APPROVE_TIERS };
