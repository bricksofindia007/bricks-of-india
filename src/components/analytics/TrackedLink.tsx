'use client';

// An outbound or in-site link that records one event per click.
// Used on server-rendered pages, where an onClick cannot be attached directly.

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { trackEvent } from '@/lib/analytics';

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'onClick'> & {
  event: string;
  params: Record<string, unknown>;
  children: ReactNode;
};

export function TrackedLink({ event, params, children, ...rest }: Props) {
  return (
    <a {...rest} onClick={() => trackEvent(event, params)}>
      {children}
    </a>
  );
}
