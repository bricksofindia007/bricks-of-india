// Legal pages, additions only (order 1055 section 2). Every live sentence stays word for word, the new text is
// shown only behind accountsEnabled, and only the sentences the owner approved in writing are added.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

const LIVE_PRIVACY = [
  'We use Google Analytics to collect visit statistics, such as pages viewed, session duration, device and browser type, and approximate location from your IP address. This data is used solely to improve the website.',
  'This website uses cookies for analytics and site functionality. You can disable cookies in your browser settings, though some site features may not function correctly.',
  'If you subscribe to our newsletter, we collect your email address. This is used only to send Bricks of India updates, deals, and LEGO® news. We do not sell, rent, or share your email address with third parties. You can unsubscribe at any time using the link in any email we send.',
  'Newsletter subscriber data is stored securely with trusted cloud service providers, which may store it outside India. We implement appropriate security measures to protect your data from unauthorized access.',
  'We do not sell personal data to third parties. Period. We barely have time to look after our own data, let alone someone else&apos;s.',
  'You have the right to access, correct, or delete your personal data held by us. To exercise these rights, contact us via the contact page. We comply with applicable data protection laws including GDPR and the Indian Information Technology Act.',
  'For privacy-related queries, use our',
];
const LIVE_TERMS = [
  'By accessing Bricks of India, you agree to the following terms. If you don&apos;t agree, the exit button is right there. No hard feelings.',
  'All written content, reviews, guides, and original text on Bricks of India is copyright © 2026 Bricks of India. You may not reproduce, distribute, or republish our content without prior written permission. Quotes with attribution and links back are fine. Wholesale copying is not.',
  'Reviews and opinion pieces represent the personal views of Bricks of India. They are editorial opinions, not professional advice. We stand by our verdicts. If you disagree, feel free to buy the set anyway. It&apos;s your money.',
  'This site is provided &quot;as is&quot; with no warranty on price accuracy. Prices may be incorrect or outdated. Always verify prices on the retailer&apos;s website before purchasing.',
  'Some store links on this website are affiliate links, and Bricks of India may earn a small commission when you buy through them or use the Toycra code ABHINAV12.',
  'Links to third-party websites (retailers, YouTube, Instagram, etc.) are provided for convenience only.',
  'LEGO® is a registered trademark of The LEGO Group. This website is not affiliated with, authorized by, or endorsed by The LEGO Group.',
  'We may update these terms at any time. Continued use of the website constitutes acceptance of the updated terms.',
];

describe('live text is untouched', () => {
  it('every live privacy sentence is still on the page', () => {
    const src = read('src/app/legal/privacy/page.tsx');
    for (const s of LIVE_PRIVACY) expect(src).toContain(s);
  });
  it('every live terms sentence is still on the page', () => {
    const src = read('src/app/legal/terms/page.tsx');
    for (const s of LIVE_TERMS) expect(src).toContain(s);
  });
});

describe('additions are behind the accounts flag', () => {
  it('the privacy and terms pages render the additions only when accountsEnabled is true', () => {
    expect(read('src/app/legal/privacy/page.tsx')).toMatch(/\{FEATURE_FLAGS\.accountsEnabled \? <PrivacyAdditions \/> : null\}/);
    expect(read('src/app/legal/terms/page.tsx')).toMatch(/\{FEATURE_FLAGS\.accountsEnabled \? <TermsAdditions \/> : null\}/);
  });
  it('accountsEnabled is false in both mirrors', () => {
    expect(read('src/lib/feature-flags.ts')).toMatch(/accountsEnabled: false,/);
    expect(read('config/feature_flags.py')).toMatch(/"accounts_enabled": False,/);
  });
});

describe('only the approved additions', () => {
  const additions = read('src/components/legal/LegalAdditions.tsx');
  it('adds the named-person sentence with the privacy mailbox', () => {
    expect(additions).toContain('Bricks of India (bricksofindia.com) is run by Abhinav Bhargav, a sole proprietor in India. Questions about your data: privacy@bricksofindia.com.');
  });
  it('adds the Mumbai courts sentence and the contact mailbox', () => {
    expect(additions).toContain('Indian law applies. Courts in Mumbai have jurisdiction.');
    expect(additions).toContain('hello@bricksofindia.com.');
  });
  it('does not add the sentences that have no written approval yet', () => {
    for (const s of [
      'What we collect, and only if you make an account',
      'Why we use it',
      'Who can see it',
      'How long we keep it',
      'Write to Abhinav Bhargav, Sole Proprietor, at corrections@bricksofindia.com',
      'Adults only',
      'If this notice changes in a way that matters',
    ]) expect(additions).not.toContain(s);
  });
  it('does not change or remove the approved copy file', () => {
    const copy = read('src/lib/legal-copy.ts');
    expect(copy).toContain("AGE_RULE_COPY");
    expect(copy).toContain("DELETION_COPY");
  });
});
