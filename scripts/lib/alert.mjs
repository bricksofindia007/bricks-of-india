// Check 11's alert sender, extracted verbatim from scripts/health-check.mjs
// (FP6.4, P4 Step 2) so the quota guards can reuse it instead of adding a new
// provider call (P4 email rule). Same Resend call, from-address, recipient
// (BRIEF_EMAIL) and test-mode behaviour: real sends only inside GitHub Actions
// or with FORCE_REAL_ALERTS=true.

const clean = (v) => (v ?? '').replace(/^\uFEFF/, '').trim();

export async function sendAlert(subject, body) {
  const RESEND_API_KEY = clean(process.env.RESEND_API_KEY);
  const BRIEF_EMAIL = clean(process.env.BRIEF_EMAIL);
  const IS_GITHUB_ACTIONS = process.env.GITHUB_ACTIONS === 'true';
  const FORCE_REAL_ALERTS = process.env.FORCE_REAL_ALERTS === 'true';
  if (!IS_GITHUB_ACTIONS && !FORCE_REAL_ALERTS) {
    console.warn(`[TEST MODE — not in GitHub Actions, alert NOT sent] ${subject}`);
    return;
  }
  if (!RESEND_API_KEY || !BRIEF_EMAIL) {
    console.warn(`ALERT (no email config): ${subject}`);
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Bricks of India <abhinav@bricksofindia.com>',
      to: [BRIEF_EMAIL],
      subject,
      html: `<pre style="font-family:monospace;font-size:14px;">${body}</pre>`,
    }),
  });
  if (!res.ok) {
    console.error(`Resend failed (${res.status}): ${await res.text()}`);
  } else {
    const sent = await res.json();
    console.log(`[alert] Email sent. ID: ${sent.id}`);
  }
}
