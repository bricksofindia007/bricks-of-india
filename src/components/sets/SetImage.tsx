'use client';

import { useState } from 'react';
import Image from 'next/image';
import { rebrickableResized, type RebrickableSize } from '@/lib/set-image';

const PLACEHOLDER = '/images/lego-placeholder.svg';

/**
 * Builds an ordered list of image URLs to try for a given set.
 * Priority:
 *  1. set.image_url       — stored Rebrickable URL in DB (resized copy first, PR-E)
 *  2. Rebrickable CDN     — constructed from rebrickable_id (includes the -1 suffix)
 *  3. Brickset CDN        — constructed from set_number (no API key needed, public CDN)
 *  4. Local placeholder   — /images/lego-placeholder.svg
 */
function buildSrcChain(set: {
  image_url?: string | null;
  rebrickable_id?: string | null;
  set_number?: string | null;
}, size: RebrickableSize): string[] {
  const chain: string[] = [];
  // PR-E: Rebrickable's resized copy first, the original only as a fallback
  // (if the resized path ever 404s the card still gets an image).
  if (set.image_url) chain.push(rebrickableResized(set.image_url, size), set.image_url);
  if (set.rebrickable_id) {
    const rb = `https://cdn.rebrickable.com/media/sets/${set.rebrickable_id}.jpg`;
    chain.push(rebrickableResized(rb, size), rb);
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
  /** 'card' (default): 250x250 resized image, lazy-loaded. 'hero': 1000x800, loaded eagerly at high priority. */
  variant?: 'card' | 'hero';
}

export function SetImage({ set, className, sizes, variant = 'card' }: SetImageProps) {
  const hero = variant === 'hero';
  const chain = buildSrcChain(set, hero ? '1000x800' : '250x250');
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
      // unoptimized: Rebrickable already serves the right size; routing through
      // next/image would add a Worker invocation + Cloudflare Images transform.
      unoptimized
      priority={hero}
      loading={hero ? undefined : 'lazy'}
      onError={handleError}
    />
  );
}
