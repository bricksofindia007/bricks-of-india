// Contact form "Privacy request" topic: who receives the message, with the flag on and off. No mail is sent: the
// email client is replaced by a recorder.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTopic, recipientFor, PRIVACY_EMAIL } from '../src/lib/contact-topic';

const flags = vi.hoisted(() => ({ privacyRequestOption: true }));
const sent = vi.hoisted(() => ({ calls: [] as Array<Record<string, unknown>> }));

vi.mock('@/lib/feature-flags', () => ({ FEATURE_FLAGS: flags }));
vi.mock('@/lib/contact-email', () => ({ CONTACT_EMAIL: 'general-inbox@example.test' }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: async (args: Record<string, unknown>) => { sent.calls.push(args); return { id: 'test' }; } };
  },
}));

import { submitContact } from '../src/app/actions/contact';

const root = join(__dirname, '..');
const GENERAL = 'general-inbox@example.test';

function form(extra: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set('name', 'Test Person');
  fd.set('email', 'reader@example.test');
  fd.set('subject', 'Test subject');
  fd.set('message', 'This is a test message of enough length.');
  fd.set('website', '');
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

describe('topic and recipient (pure)', () => {
  it('only the exact value privacy selects the privacy topic', () => {
    expect(parseTopic('privacy')).toBe('privacy');
    expect(parseTopic('Privacy')).toBe('general');
    expect(parseTopic(null)).toBe('general');
    expect(parseTopic(undefined)).toBe('general');
  });
  it('the privacy mailbox receives a privacy request only while the flag is on', () => {
    expect(recipientFor('privacy', true, GENERAL)).toBe(PRIVACY_EMAIL);
    expect(recipientFor('privacy', false, GENERAL)).toBe(GENERAL);
    expect(recipientFor('general', true, GENERAL)).toBe(GENERAL);
    expect(recipientFor('general', false, GENERAL)).toBe(GENERAL);
  });
  it('the privacy address is the approved mailbox', () => {
    expect(PRIVACY_EMAIL).toBe('privacy@bricksofindia.com');
  });
});

describe('the contact action sends to the right mailbox', () => {
  beforeEach(() => { sent.calls.length = 0; flags.privacyRequestOption = true; });

  it('flag on, Privacy request ticked: the message goes to the privacy mailbox', async () => {
    const r = await submitContact({ ok: false }, form({ topic: 'privacy' }));
    expect(r.ok).toBe(true);
    expect(sent.calls).toHaveLength(1);
    expect(sent.calls[0].to).toBe(PRIVACY_EMAIL);
    expect(sent.calls[0].subject).toBe('[Contact] Test subject');
  });
  it('flag on, not ticked: the message goes to the general address', async () => {
    await submitContact({ ok: false }, form());
    expect(sent.calls[0].to).toBe(GENERAL);
  });
  it('flag off, Privacy request sent anyway: the message still goes to the general address', async () => {
    flags.privacyRequestOption = false;
    await submitContact({ ok: false }, form({ topic: 'privacy' }));
    expect(sent.calls[0].to).toBe(GENERAL);
  });
  it('the reply goes to the reader, whichever mailbox receives it', async () => {
    await submitContact({ ok: false }, form({ topic: 'privacy' }));
    expect(sent.calls[0].replyTo).toBe('reader@example.test');
  });
});

describe('the page', () => {
  const page = readFileSync(join(root, 'src/app/contact/page.tsx'), 'utf8');
  it('shows the tick only inside the flag check', () => {
    expect(page).toMatch(/\{FEATURE_FLAGS\.privacyRequestOption && \(/);
    expect(page).toMatch(/name="topic" value="privacy"/);
  });
  it('the privacy address is not written into the page', () => {
    expect(page).not.toContain('privacy@bricksofindia.com');
  });
});
