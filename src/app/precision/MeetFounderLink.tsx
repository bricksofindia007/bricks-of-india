'use client';

// Same in-site link as before (next/link, so navigation is unchanged), with one click tag.
// Client boundary so app/precision/page.tsx can stay a Server Component.

import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';

export function MeetFounderLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={className} onClick={() => trackEvent('click_meet_founder', { page_type: 'precision' })}>
      {children}
    </Link>
  );
}
