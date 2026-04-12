'use client';

import { useState } from 'react';
import Image from 'next/image';

const PLACEHOLDER = '/images/lego-placeholder.svg';

/**
 * Builds an ordered list of image URLs to try for a given set.
 * Priority:
 *  1. set.image_url       — stored Rebrickable URL in DB
 *  2. Rebrickable CDN     — constructed from rebrickable_id (includes the -1 suffix)
 *  3. Brickset CDN        — constructed from set_number (no API key needed, public CDN)
 *  4. Local placeholder   — /images/lego-placeholder.svg
 */
function buildSrcChain(set: {
  image_url?: string | null;
  rebrickable_id?: string | null;
  set_number?: string | null;
}): string[] {
  const chain: string[] = [];
  if (set.image_url) chain.push(set.image_url);
  if (set.rebrickable_id) {
    chain.push(`https://cdn.rebrickable.com/media/sets/${set.rebrickable_id}.jpg`);
  }
  if (set.set_number) {
    chain.push(`https://images.brickset.com/sets/images/${set.set_number}-1.jpg`);
  }
  chain.push(PLACEHOLDER);
  // Deduplicate while preserving order
  return chain.filter((v, i) => chain.indexOf(v) === i);
}

interface SetImageProps {
  set: {
    image_url?: string | null;
    rebrickable_id?: string | null;
    set_number?: string | null;
    name: string;
  };
  className?: string;
  sizes?: string;
}

export function SetImage({ set, className, sizes }: SetImageProps) {
  const chain = buildSrcChain(set);
  const [idx, setIdx] = useState(0);

  const handleError = () => {
    // Advance to next fallback, stopping at the last entry (placeholder)
    setIdx((i) => Math.min(i + 1, chain.length - 1));
  };

  return (
    <Image
      src={chain[idx]}
      alt={set.name}
      fill
      className={className}
      sizes={sizes ?? '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw'}
      unoptimized
      onError={handleError}
    />
  );
}
