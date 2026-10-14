'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { BRICK_RUSH, saleActive, saleInr } from '@/lib/sale-hub';

// Sale hub line on a sale set's page; hidden for sets not in the sale and after the sale ends.
export function SaleSetLine({ setNumber }: { setNumber: string }) {
  const price = BRICK_RUSH.prices[setNumber];
  const [on, setOn] = useState(() => price != null && saleActive(BRICK_RUSH));
  useEffect(() => { setOn(price != null && saleActive(BRICK_RUSH)); }, [price]);
  if (!on || price == null) return null;
  return (
    <Link href={BRICK_RUSH.href} className="block bg-accent/20 border-2 border-accent rounded-xl px-4 py-3 mb-6 font-bold text-dark hover:bg-accent/30">
      🧱 {BRICK_RUSH.setLine(saleInr(price))} →
    </Link>
  );
}
