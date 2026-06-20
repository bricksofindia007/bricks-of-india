'use strict';

// Filler-content patterns: recurring low-editorial-value post formats that
// slip past the score threshold but shouldn't become BOI articles.
// "of the day" catches "Random figure of the day", "Set of the Day", etc.
// "^random " catches Brickset "Random X" filler posts.
// "daily " is deliberately narrow (trailing space) to avoid matching "today".
const FILLER_RE = /^random\s+|\bof[\s-]the[\s-]day\b|\bdaily\s/i;

function isFillerPattern(title) {
  return FILLER_RE.test(title || '');
}

module.exports = { isFillerPattern, FILLER_RE };
