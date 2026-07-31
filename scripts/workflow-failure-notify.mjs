/**
 * Generic workflow notification sender via Resend. Two modes:
 *
 * NOTIFY_TYPE=failure (default, original behavior, unchanged) — sends one
 * email when any step in the calling workflow failed. Unlike
 * scripts/code-audit-notify.mjs (hardcoded to 4 named checks via 4 specific
 * env vars), this is data-driven: the calling workflow passes its own step
 * names/outcomes as a JSON map.
 *
 * NOTIFY_TYPE=custom (added 2026-08-01, for non-failure notifications like
 * "video ready for review") — sends whatever SUBJECT/BODY the calling
 * workflow provides directly, bypassing the STEP_OUTCOMES/failure-only
 * logic entirely. Kept minimal and content-agnostic here (the actual "video
 * ready" framing lives in the calling workflow's env values, not in this
 * shared script) so this stays reusable for any future one-off
 * notification, not just this one.
 *
 * Required env:
 *   RESEND_API_KEY
 *   (failure mode) WORKFLOW_NAME  — human-readable name, e.g. "reviews-weekly-refresh"
 *   (failure mode) STEP_OUTCOMES  — JSON string, { "<step label>": "success"|"failure"|"skipped"|"cancelled", ... }
 *   (custom mode)  SUBJECT, BODY  — sent as-is, no templating applied here
 * Optional env:
 *   NOTIFY_TYPE     — 'failure' (default) or 'custom'
 *   ALERT_EMAIL     — defaults to abhinav@bricksofindia.com (matches BRIEF_EMAIL
 *                     fallback convention used elsewhere, e.g. scrape-now.mjs)
 *   BRIEF_EMAIL     — same default, alternate name, checked if ALERT_EMAIL unset
 *   EXTRA_DETAIL    — (failure mode only) free-text appended to the email body
 *   RUN_URL         — (failure mode only) overrides the auto-constructed run link
 *
 * Usage, failure mode (from a workflow step, after continue-on-error steps with `id:`):
 *   - name: Send failure alert
 *     if: steps.mystep.outcome == 'failure'
 *     env:
 *       RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
 *       WORKFLOW_NAME: my-workflow
 *       STEP_OUTCOMES: '{"My step": "${{ steps.mystep.outcome }}"}'
 *     run: node scripts/workflow-failure-notify.mjs
 *
 * Usage, custom mode:
 *   - name: Send video-ready notification
 *     if: steps.render.outputs.status == 'pending_approval'
 *     env:
 *       RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
 *       NOTIFY_TYPE: custom
 *       SUBJECT: 'Video ready: ...'
 *       BODY: |
 *         Multi-line body text here.
 *     run: node scripts/workflow-failure-notify.mjs
 */

import { Resend } from 'resend';

const key = (process.env.RESEND_API_KEY || '').replace(/^﻿/, '').trim();
if (!key) { console.error('[workflow-failure-notify] RESEND_API_KEY not set'); process.exit(1); }

const alertEmail = process.env.ALERT_EMAIL || process.env.BRIEF_EMAIL || 'abhinav@bricksofindia.com';
const notifyType = process.env.NOTIFY_TYPE || 'failure';

if (notifyType === 'custom') {
  const subject = process.env.SUBJECT;
  const body = process.env.BODY;
  if (!subject || !body) {
    console.error('[workflow-failure-notify] NOTIFY_TYPE=custom requires both SUBJECT and BODY env vars.');
    process.exit(1);
  }
  const resend = new Resend(key);
  const { error } = await resend.emails.send({
    from: 'Bricks of India <abhinav@bricksofindia.com>',
    to: alertEmail,
    subject,
    text: body,
  });
  if (error) {
    console.error('[workflow-failure-notify] Resend error:', error.message);
    process.exit(1);
  }
  console.log('[workflow-failure-notify] Custom notification sent:', subject);
  process.exit(0);
}

const workflowName = process.env.WORKFLOW_NAME || 'unknown workflow';

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
