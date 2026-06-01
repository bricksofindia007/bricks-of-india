/**
 * Sends a failure alert email for the weekly code audit workflow.
 * Called by .github/workflows/code-audit.yml when any check fails.
 * Reads outcomes from env vars set by the workflow step context.
 */

import { Resend } from 'resend';

const key = (process.env.RESEND_API_KEY || '').replace(/^﻿/, '').trim();
if (!key) { console.error('[code-audit-notify] RESEND_API_KEY not set'); process.exit(1); }

const checks = {
  'ESLint (npm run lint)':         process.env.LINT_OUTCOME      || 'skipped',
  'TypeScript (tsc --noEmit)':     process.env.TYPECHECK_OUTCOME || 'skipped',
  'npm audit --audit-level=high':  process.env.AUDIT_OUTCOME     || 'skipped',
  'Secrets manifest audit':        process.env.SECRETS_OUTCOME   || 'skipped',
};

const failed  = Object.entries(checks).filter(([, v]) => v === 'failure').map(([k]) => k);
const passed  = Object.entries(checks).filter(([, v]) => v === 'success').map(([k]) => k);

const subject = `[BOI Code Audit FAIL] ${failed.join(' · ')}`;
const body = [
  'Weekly code audit found issues on bricksofindia.com:',
  '',
  ...failed.map(f => `❌  ${f}`),
  ...passed.map(p => `✅  ${p}`),
  '',
  'View run:',
  'https://github.com/bricksofindia007/bricks-of-india/actions/workflows/code-audit.yml',
].join('\n');

const resend = new Resend(key);
const { error } = await resend.emails.send({
  from:    'Bricks of India <abhinav@bricksofindia.com>',
  to:      'abhinav@bricksofindia.com',
  subject,
  text:    body,
});

if (error) {
  console.error('[code-audit-notify] Resend error:', error.message);
  process.exit(1);
}
console.log('[code-audit-notify] Alert sent:', subject);
