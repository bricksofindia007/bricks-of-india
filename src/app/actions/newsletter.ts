'use server';

import { createServerClient } from '@/lib/supabase';
import { Resend } from 'resend';

export async function subscribeNewsletter(email: string): Promise<{ ok: boolean; duplicate?: boolean }> {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false };
  }

  const supabase = createServerClient();
  const { error } = await supabase
    .from('newsletter_subscribers')
    .insert({ email });

  const duplicate = error?.code === '23505';
  if (error && !duplicate) {
    console.error('[supabase-write] table=newsletter_subscribers op=insert error:', error);
    return { ok: false };
  }

  // Send confirmation only on new subscribers (not duplicates)
  if (!duplicate) {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      console.log('[newsletter] sending confirmation to:', email);
      const { error: mailErr } = await resend.emails.send({
        from: 'Bricks of India <abhinav@bricksofindia.com>',
        replyTo: 'abhinav@bricksofindia.com',
        to: email,
        subject: "You're in. Your wallet has been warned. 🧱",
        text: [
          "Welcome to Bricks of India.",
          "",
          "You'll hear from us when LEGO prices in India are actually worth talking about — new set launches, price drops, import alerts, and the occasional rant about why sets cost 40% more here than everywhere else.",
          "",
          "No spam. No daily blasts. Just the stuff that matters to your wallet.",
          "",
          "In the meantime, check out what's on at bricksofindia.com — live prices from Toycra and MyBrickHouse, all in one place.",
          "",
          "On that bombshell,",
          "Abhinav",
          "Bricks of India — https://bricksofindia.com",
        ].join('\n'),
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a;">
  <h2 style="color:#f59e0b;font-size:24px;margin-bottom:4px;">You're in.</h2>
  <h3 style="color:#1a1a1a;font-size:18px;margin-top:0;">Your wallet has been warned. 🧱</h3>

  <p>Welcome to <strong>Bricks of India</strong>.</p>

  <p>You'll hear from us when LEGO prices in India are actually worth talking about — new set launches, price drops, import alerts, and the occasional rant about why sets cost 40% more here than everywhere else.</p>

  <p>No spam. No daily blasts. Just the stuff that matters to your wallet.</p>

  <p>In the meantime, check out what's on:</p>

  <p style="margin:16px 0;">
    <a href="https://bricksofindia.com/compare"
       style="background:#f59e0b;color:#1a1a1a;font-weight:bold;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;">
      Compare LEGO Prices in India →
    </a>
  </p>

  <p style="font-size:13px;color:#6b7280;margin-top:32px;">
    Live prices from Toycra and MyBrickHouse — all in one place.<br>
    <a href="https://bricksofindia.com/legal/privacy" style="color:#6b7280;">Privacy Policy</a> ·
    You subscribed at <a href="https://bricksofindia.com" style="color:#6b7280;">bricksofindia.com</a>
  </p>

  <p style="font-size:13px;color:#6b7280;">
    On that bombshell,<br>
    <strong>Abhinav</strong> — Bricks of India
  </p>
</body>
</html>`,
      });
      if (mailErr) {
        console.error('[newsletter] confirmation email FAILED — to:', email,
          '| name:', mailErr.name,
          '| message:', mailErr.message,
        );
      } else {
        console.log('[newsletter] confirmation sent ok to:', email);
      }
    } catch (mailErr: any) {
      // Log but don't fail the subscription — user is already in the DB
      console.error('[newsletter] confirmation email FAILED (thrown) — to:', email,
        '| message:', mailErr?.message,
      );
    }
  }

  return { ok: true, duplicate };
}
