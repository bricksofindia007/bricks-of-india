/**
 * Generic workflow-failure alert — sends one Resend email when any step in
 * the calling workflow failed. Unlike scripts/code-audit-notify.mjs (which
 * is hardcoded to 4 named checks via 4 specific env vars), this script is
 * data-driven: the calling workflow passes its own step names/outcomes as a
 * JSON map, so any workflow can reuse this unmodified.
 *
 * Required env:
 *   RESEND_API_KEY
 *   WORKFLOW_NAME   — human-readable name, e.g. "reviews-weekly-refresh"
 *   STEP_OUTCOMES   — JSON string, { "<step label>": "success"|"failure"|"skipped"|"cancelled", ... }
 * Optional env:
 *   ALERT_EMAIL     — defaults to abhinav@bricksofindia.com (matches BRIEF_EMAIL
 *                     fallback convention used elsewhere, e.g. scrape-now.mjs)
 *   BRIEF_EMAIL     — same default, alternate name, checked if ALERT_EMAIL unset
 *   EXTRA_DETAIL    — free-text appended to the email body (e.g. a specific
 *                     assertion failure's row/field detail)
 *   RUN_URL         — overrides the auto-constructed GitHub Actions run link
 *
 * Usage (from a workflow step, after continue-on-error steps with `id:`):
 *   - name: Send failure alert
 *     if: steps.mystep.outcome == 'failure'
 *     env:
 *       RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
 *       WORKFLOW_NAME: my-workflow
 *       STEP_OUTCOMES: '{"My step": "${{ steps.mystep.outcome }}"}'
 *     run: node scripts/workflow-failure-notify.mjs
 */

import { Resend } from 'resend';

const key = (process.env.RESEND_API_KEY || '').replace(/^﻿/, '').trim();
if (!key) { console.error('[workflow-failure-notify] RESEND_API_KEY not set'); process.exit(1); }

const workflowName = process.env.WORKFLOW_NAME || 'unknown workflow';
const alertEmail   = process.env.ALERT_EMAIL || process.env.BRIEF_EMAIL || 'abhinav@bricksofindia.com';

let steps;
try {
  steps = JSON.parse(process.env.STEP_OUTCOMES || '{}');
} catch (e) {
  console.error('[workflow-failure-notify] STEP_OUTCOMES is not valid JSON:', e.message);
  process.exit(1);
}

const failed = Object.entries(steps).filter(([, v]) => v === 'failure').map(([k]) => k);
const others = Object.entries(steps).filter(([, v]) => v !== 'failure');

if (failed.length === 0) {
  console.log('[workflow-failure-notify] No failed steps in STEP_OUTCOMES — nothing to send.');
  process.exit(0);
}

const runUrl = process.env.RUN_URL
  || `${process.env.GITHUB_SERVER_URL || 'https://github.com'}/${process.env.GITHUB_REPOSITORY || 'bricksofindia007/bricks-of-india'}/actions/runs/${process.env.GITHUB_RUN_ID || ''}`;

const subject = `[BOI Workflow FAIL] ${workflowName}: ${failed.join(' · ')}`;
const bodyLines = [
  `Workflow "${workflowName}" had a step failure:`,
  '',
  ...failed.map(f => `❌  ${f}`),
  ...others.map(([k, v]) => `${v === 'success' ? '✅' : '➖'}  ${k} (${v})`),
];
if (process.env.EXTRA_DETAIL) {
  bodyLines.push('', 'Detail:', process.env.EXTRA_DETAIL);
}
bodyLines.push('', 'View run:', runUrl);
const body = bodyLines.join('\n');

const resend = new Resend(key);
const { error } = await resend.emails.send({
  from:    'Bricks of India <abhinav@bricksofindia.com>',
  to:      alertEmail,
  subject,
  text:    body,
});

if (error) {
  console.error('[workflow-failure-notify] Resend error:', error.message);
  process.exit(1);
}
console.log('[workflow-failure-notify] Alert sent:', subject);
