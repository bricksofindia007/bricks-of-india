import type { ReactNode } from 'react';
import { ShareMount } from '@/components/share/ShareMount';

// Adds the share control under each Lab tool page. Renders nothing while the share flag is off.
export default function LabLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {children}
      <ShareMount />
    </>
  );
}
