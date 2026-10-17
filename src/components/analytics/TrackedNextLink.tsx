'use client';

// A Next.js link that records one event per click. Keeps client-side navigation.
// Used inside server components (for example the set cards on the compare page).

import Link from 'next/link';
import type { ReactNode } from 'react';
import { trackEvent } from '@/lib/analytics';

type Props = {
  href: string;
  className?: string;
  event?: string;
  params?: Record<string, unknown>;
  children: ReactNode;
};

export function TrackedNextLink({ href, className, event, params, children }: Props) {
  return (
    <Link
      href={href}
      className={className}
      onClick={event ? () => trackEvent(event, params ?? {}) : undefined}
    >
      {children}
    </Link>
  );
}
