import { Fragment } from 'react';
import Link from 'next/link';
import { DISCLOSURE_MD } from '@/lib/affiliate-disclosure';

// Round 11 (chat, 2 Oct 2026): FAQ answers carry the article line's same-sentence Disclosure
// link. The answer text keeps the markdown form (the FAQ JSON-LD turns it into an <a>); this
// renders it as a real link on the page.
export function WithDisclosureLink({ text }: { text: string }) {
  const parts = text.split(DISCLOSURE_MD);
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && (
            <Link href="/legal/affiliate-disclosure" className="underline hover:no-underline">Disclosure</Link>
          )}
        </Fragment>
      ))}
    </>
  );
}
