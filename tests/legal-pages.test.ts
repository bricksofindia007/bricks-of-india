// Legal and account pages: owner text verbatim, no placeholder markers, everything behind the accounts flag.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as copy from '../src/lib/legal-copy';
import { alertEmailFooter } from '../src/lib/alert-email-footer';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('owner text is verbatim', () => {
  it('18+ tick box and blocked message', () => {
    expect(copy.AGE_TICK_LABEL).toBe('I confirm I am 18 or older.');
    expect(copy.AGE_BLOCKED_MESSAGE).toBe('Accounts are for adults only, for now. You can still browse everything on the site without one.');
  });

  it('privacy has the eleven sections in order', () => {
    expect(copy.PRIVACY_SECTIONS.map((s) => s.lead)).toEqual([
      'Who we are.',
      'What we collect, and only if you make an account:',
      'What we collect from everyone, with or without an account:',
      'ANALYTICS',
      'EMAIL NEWSLETTER',
      'Why we use it:',
      'Who can see it.',
      'How long we keep it.',
      'Your data.',
      'Complaints.',
      'Changes.',
    ]);
    const all = copy.PRIVACY_SECTIONS.map((s) => s.text).join(' ');
    expect(all).toContain('We do not sell your data. We do not use it for advertising.');
    expect(all).toContain('(we email you a month before), whichever comes first.');
    expect(all).toContain('corrections@bricksofindia.com');
  });

  it('terms has ten numbered items', () => {
    expect(copy.TERMS_SECTIONS.map((s) => s.lead.split(' ')[0])).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
    expect(copy.TERMS_SECTIONS[0].text).toContain('LEGO is a trademark of the LEGO Group, which does not sponsor or endorse this site.');
    expect(copy.TERMS_SECTIONS[9].text).toBe('hello@bricksofindia.com.');
  });

  it('delete page heading, paragraphs and button', () => {
    expect(copy.DELETE_HEADING).toBe('Want out? Fair enough.');
    expect(copy.DELETE_PARAGRAPHS[3]).toBe('Your data is removed from the live site straight away. Copies held only as safety backups are removed within 13 months.');
    expect(copy.DELETE_BUTTON).toBe('Delete my account');
    expect(copy.DELETE_DONE_TEXT).toBe('Done. Your account is gone. You will get one last email to confirm it.');
  });

  it('alert consent text', () => {
    expect(copy.ALERT_CONSENT_TEXT).toBe('Email me when sets on my wishlist are released or change price. You can stop any time.');
  });
});

describe('no placeholder or removed text', () => {
  const everything = JSON.stringify(copy);
  it('no [CONFIRM] marker and no Data Protection Board sentence', () => {
    expect(everything).not.toMatch(/\[CONFIRM\]/);
    expect(everything).not.toMatch(/Data Protection Board/);
  });

  it('the delete page text says backups are removed within 13 months, not 30 days', () => {
    const pageText = copy.DELETE_PARAGRAPHS.join(' ');
    expect(pageText).toContain('13 months');
    expect(pageText).not.toMatch(/backups[^.]*30 days/);
    expect(pageText).toContain(copy.HELD_DELETE_BACKUP_SENTENCE);
  });

  it('the privacy notice keeps the 30-day response time', () => {
    const all = copy.PRIVACY_SECTIONS.map((s) => s.text).join(' ');
    expect(all).toContain('We reply within 30 days.');
  });
});

describe('analytics and newsletter paragraphs match the live privacy page', () => {
  const live = read('src/app/legal/privacy/page.tsx');
  for (const lead of ['ANALYTICS', 'EMAIL NEWSLETTER']) {
    it(`${lead} text is copied verbatim`, () => {
      const section = copy.PRIVACY_SECTIONS.find((s) => s.lead === lead);
      expect(section).toBeDefined();
      expect(live).toContain(section!.text);
    });
  }
});

describe('alert email footer', () => {
  it('fills both links into the verbatim footer', () => {
    const out = alertEmailFooter({ unsubscribe: 'https://x/u', deleteAccount: 'https://x/d' });
    expect(out).toBe('You are getting this because you turned on alerts at Bricks of India. Unsubscribe here: https://x/u. Delete your account: https://x/d.');
  });
});

describe('everything sits behind the accounts flag', () => {
  it('the flag is off', () => {
    expect(read('src/lib/feature-flags.ts')).toMatch(/accountsEnabled: false/);
  });

  it('privacy and terms show the new notices only when the flag is on', () => {
    expect(read('src/app/legal/privacy/page.tsx')).toMatch(/if \(FEATURE_FLAGS\.accountsEnabled\) return <PrivacyNotice \/>;/);
    expect(read('src/app/legal/terms/page.tsx')).toMatch(/if \(FEATURE_FLAGS\.accountsEnabled\) return <TermsNotice \/>;/);
  });

  it('the delete page is not found while the flag is off', () => {
    const src = read('src/app/account/delete/page.tsx');
    expect(src).toMatch(/if \(!FEATURE_FLAGS\.accountsEnabled\) notFound\(\);/);
    expect(src).toMatch(/robots: \{ index: false/);
  });

  it('the affiliate disclosure page the terms point to exists', () => {
    expect(existsSync(join(root, 'src/app/legal/affiliate-disclosure/page.tsx'))).toBe(true);
  });
});
