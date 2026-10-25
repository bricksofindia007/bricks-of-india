// Sends the sign-in code. Owner option A (spec, 24 Oct 2026): ONE direct mail-provider path for emailed codes, behind the
// send stop line (DAILY_SEND_STOP in signin-email.ts). This is the only direct provider call for mail; it is an exception to
// G12 for sign-in codes only, and it is tracked in the issue for the central gateway.
// Sender and reply-to follow docs/email/ADDRESSES.md: login@ sends, hello@ receives replies.
// Failure behaviour: a clear refusal (the provider rejects the message, or it is never sent) throws MailRefused, so the
// send is given back. Anything else throws a plain error, an unclear outcome, and the send stays counted.
import { getSecret } from '@/lib/get-secret';
import { MailRefused, type CodeMailer } from '@/lib/signin-email';

export const SIGN_IN_FROM = 'Bricks of India <login@bricksofindia.com>';
export const SIGN_IN_REPLY_TO = 'hello@bricksofindia.com';
const ENDPOINT = 'https://api.resend.com/emails';
const TIMEOUT_MS = 8000;

// Wording (order 1247, 25 Oct): the subject and the "Didn't ask for this?" line are the approved ones. The sentence that
// gives the code and the 10-minute expiry is still the earlier placeholder: Chat has not sent its exact approved sentence
// yet. The body carries the code and the expiry only: no address, no account detail.
export function signInMessage(code: string): { subject: string; text: string } {
  return {
    subject: 'Your Bricks of India code',
    text: `Your sign-in code is ${code}. It expires in 10 minutes.\n\nDidn't ask for this? Ignore this email.`,
  };
}

export class ResendCodeMailer implements CodeMailer {
  async send(to: string, body: { code: string }, idempotencyKey: string): Promise<void> {
    const key = getSecret('RESEND_API_KEY');
    // Not configured: nothing leaves, so this is a clear refusal and the send is given back.
    if (!key) throw new MailRefused();

    const msg = signInMessage(body.code);
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ from: SIGN_IN_FROM, to: [to], reply_to: SIGN_IN_REPLY_TO, subject: msg.subject, text: msg.text }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.ok) return;
    // A 4xx answer means the provider refused the message; it did not go out. 408 is a timeout, so it stays unclear.
    if (res.status >= 400 && res.status < 500 && res.status !== 408) throw new MailRefused();
    throw new Error('mail outcome unclear');
  }
}
