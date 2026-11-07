// Additions to the live privacy and terms pages (order 1055 section 2). ADDITIONS ONLY: no live sentence is
// removed or reworded. Shown only when accountsEnabled is true (the pages gate it). Every sentence here was
// approved in writing by the owner (11:12 IST, 27 Oct 2026: additions only, the mailboxes, the named person,
// the Mumbai clause). Other new sentences from the earlier draft are NOT here until approved.

export function PrivacyAdditions() {
  return (
    <>
      <section>
        <h2 className="font-heading text-dark text-2xl mb-3">WHO WE ARE</h2>
        <p>Bricks of India (bricksofindia.com) is run by Abhinav Bhargav, a sole proprietor in India. Questions about your data: privacy@bricksofindia.com.</p>
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
    </>
  );
}
