'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BRICK_RUSH, saleActive } from '@/lib/sale-hub';

// Sale hub banner (homepage + /deals). Rendered with the server's view, then re-checked in the
// browser so a cached page stops showing it the moment the sale ends.
export function SaleBanner() {
  const [on, setOn] = useState(() => saleActive(BRICK_RUSH));
  useEffect(() => { setOn(saleActive(BRICK_RUSH)); }, []);
  if (!on) return null;
  return (
    <div className="bg-accent text-dark">
      <div className="max-w-site mx-auto px-4 py-3">
        <Link href={`/${BRICK_RUSH.slug}`} className="font-bold text-sm md:text-base hover:underline">
          🧱 {BRICK_RUSH.banner}
        </Link>
      </div>
    </div>
  );
}
