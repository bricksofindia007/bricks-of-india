'use client';

// Tiny client boundary so app/precision/page.tsx can stay a Server Component
// (needed for its `export const metadata` noindex block) while these three
// CTAs still fire a GA4 click event. No gtag wrapper/helper exists anywhere
// else in this codebase (checked -- window.gtag is only ever defined by the
// inline snippet in src/app/layout.tsx and never called again) so this calls
// window.gtag directly rather than inventing a new abstraction.

import Link from 'next/link';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

function fireGtagClick(eventName: string) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName);
  }
}

interface PrecisionCtaProps {
  href: string;
  eventName: string;
  external?: boolean;
  className: string;
  children: React.ReactNode;
}

export function PrecisionCta({ href, eventName, external, className, children }: PrecisionCtaProps) {
  if (external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={() => fireGtagClick(eventName)}
      >
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={className} onClick={() => fireGtagClick(eventName)}>
      {children}
    </Link>
  );
}
