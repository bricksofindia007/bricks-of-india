/**
 * Single source of truth for which script owns which content_quality_issues
 * check_name. Every writer of that table imports its own list from here
 * instead of declaring it locally, so there is exactly one place this can
 * drift out of sync with reality -- and scripts/lint-check-name-ownership.mjs
 * (run in CI, see .github/workflows/content-quality-ownership-lint.yml)
 * verifies it never does.
 *
 * BOI Fix Brief (2026-08-24), Phase 0.2 incident addendum, item 4: this
 * table turned out to be shared by 3 independent scripts with previously-
 * implicit ownership boundaries -- content-linter.mjs's first reconcile
 * fix didn't know that and wrongly auto-resolved 187 real open issues it
 * doesn't check for at all. This manifest + the CI lint make that bug
 * class structurally unable to recur silently: a new check_name with no
 * declared owner, or a check_name used by a file that doesn't declare it,
 * fails CI instead of shipping.
 *
 * `html_comment_visible` is the one check_name genuinely co-owned by two
 * scripts (content-linter.mjs's raw-text scan and visual-renderer.mjs's
 * rendered-DOM scan can each independently catch it) -- both declaring it
 * is correct, not an error.
 */

export const CHECK_NAME_OWNERS = {
  'content-linter.mjs': [
    'bad_opener', 'broken_image', 'capitalisation_error', 'consecutive_blank_lines',
    'double_space', 'draft_marker_leaked', 'duplicate_image', 'duplicate_opener',
    'duplicate_title', 'forbidden_word', 'html_comment_visible', 'india_paragraph_marker',
    'jaiman_reference', 'markdown_asterisk', 'markdown_bold', 'markdown_header',
    'markdown_list', 'missing_image', 'missing_india_paragraph', 'missing_signoff',
    'missing_store_mention', 'missing_verdict', 'placeholder_image', 'script_injection',
    'thin_content', 'trailing_space', 'verdict_drift', 'wall_of_text',
    'word_count_high', 'word_count_low',
    // from checkReviewSourceGates (src/lib/review-source-quality.ts), called
    // from within content-linter.mjs -- these are this script's issues too.
    'review_source_no_fabrication', 'review_source_verdict_validity',
    'review_source_disclaimer_consistency', 'source_freshness_stale',
  ],
  'visual-renderer.mjs': [
    'font_body', 'horizontal_scroll', 'html_comment_visible', 'image_render_broken',
    'mobile_overflow', 'page_load_error', 'placeholder_text', 'raw_markdown_visible',
  ],
  'reviews-source-refresh.mjs': [
    'review_out_of_stock', 'verdict_flip_candidate', 'review_set_unmatched',
    'review_source_fetch_incomplete', 'review_resplice_failed',
  ],
  'guide-staleness-guard.js': [
    'guide_staleness',
  ],
};

// Historical check_names no current script produces -- rows under these
// names may still exist (or be resolved) in the table, but nothing should
// be actively inserting them. If the lint ever finds one of these in a
// writer's live code, that's worth a second look (a name silently
// resurrected, or a rename that didn't fully land), not necessarily an
// error on its own.
export const RETIRED_CHECK_NAMES = ['word_count', 'all_caps_word'];
