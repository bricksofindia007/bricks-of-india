'use client';

// Shows the share control on a registered page only. Unregistered pages (the Lab hub, /lab/cmf-tracker) get nothing.

import { usePathname } from 'next/navigation';
import { targetForPath } from '@/lib/share';
import { ShareControl } from '@/components/share/ShareControl';

export function ShareMount() {
  const pathname = usePathname();
  const target = targetForPath(pathname);
  if (!target) return null;
  return <ShareControl target={target} />;
}
