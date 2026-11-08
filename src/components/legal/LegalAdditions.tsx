// Additions to the live privacy and terms pages (order 1055 section 2). ADDITIONS ONLY: no live sentence is
// removed or reworded. Shown only when accountsEnabled is true (the pages gate it). Every sentence here was
// approved in writing by the owner (11:12 IST, 27 Oct 2026: additions only, the mailboxes, the named person,
// the Mumbai clause). The account sentences below were approved in writing by the owner (8 Nov 2026, 14:41 IST).
// Other new sentences from the earlier draft are NOT here until approved.

import Link from 'next/link';

export function PrivacyAdditions() {
  return (
    <>
      <section>
        <h2 className="font-heading text-dark text-2xl mb-3">WHO WE ARE</h2>
        <p>Bricks of India (bricksofindia.com) is run by Abhinav Bhargav, a sole proprietor in India. Questions about your data: privacy@bricksofindia.com.</p>
      </section>
      <section>
        <h2 className="font-heading text-dark text-2xl mb-3">IF YOU SIGN UP</h2>
        <p>Sign up and we keep three things: your email address, your Wishlist and your Collection. That&apos;s the lot. No snooping, no selling, no sneaky extras.</p>
      </section>
      <section>
        <h2 className="font-heading text-dark text-2xl mb-3">SIGNING IN</h2>
        <p>Sign in with Google or with a link we email you. No passwords to forget, which is one less thing for your brain to store. Accounts are for grown-ups (18+); our <Link href="/legal/age-rule" className="underline">age rule page</Link> explains why.</p>
      </section>
      <section>
        <h2 className="font-heading text-dark text-2xl mb-3">DELETING YOUR ACCOUNT</h2>
        <p>Changed your mind? No hard feelings, and no guilt trips. Delete your account any time and it&apos;s gone within 30 days. Copies held only as safety backups are removed within 13 months. Our <Link href="/legal/data-deletion" className="underline">account deletion page</Link> has the details.</p>
      </section>
      <section>
        <h2 className="font-heading text-dark text-2xl mb-3">INACTIVE ACCOUNTS</h2>
        <p>Gone quiet for 24 months? We&apos;ll email you first, then take the hint and delete your account. Sign in any time before that and it stays.</p>
      </section>
    </>
  );
}

export function TermsAdditions() {
  return (
    <>
      <section>
        <h2 className="font-heading text-dark text-2xl mb-3">LAW</h2>
        <p>Indian law applies. Courts in Mumbai have jurisdiction.</p>
      </section>
      <section>
        <h2 className="font-heading text-dark text-2xl mb-3">CONTACT</h2>
        <p>hello@bricksofindia.com.</p>
      </section>
      <section>
        <h2 className="font-heading text-dark text-2xl mb-3">ACCOUNTS</h2>
        <p>Accounts are for grown-ups (18+). One account each, please, and what happens in it is on you, like that impulse buy at 2 a.m.</p>
      </section>
    </>
  );
}
