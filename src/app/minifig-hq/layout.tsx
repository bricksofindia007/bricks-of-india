import type { ReactNode } from 'react';
import { ShareMount } from '@/components/share/ShareMount';

// Adds the share control under Minifig HQ. Renders nothing while the share flag is off.
export default function MinifigHqLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ShareMount />
    </>
  );
}
