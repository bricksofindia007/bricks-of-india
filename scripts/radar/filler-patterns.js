'use strict';

// Targets Brickset "Random <type> of the day/week" recurring filler posts.
// Deliberately narrow: only the exact head-of-title pattern qualifies.
// "Random build spotlight", "Set of the Day", "\bdaily\s" are intentionally
// NOT matched — see filler-filter.test.js for regression anchors.
const FILLER_RE = /^random (set|figure|minifigure|build|theme) of the (day|week)/i;

function isFillerPattern(title) {
  return FILLER_RE.test(title || '');
}

module.exports = { isFillerPattern, FILLER_RE };
