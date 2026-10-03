'use client';

import { useState } from 'react';
import Image from 'next/image';
import { isKnownMissingImage } from '@/lib/missing-images';

interface ImageWithFallbackProps {
  srcs: string[];           // ordered list of URLs to try; last should be a reliable local path
  alt: string;
  fill?: boolean;
  width?: number;
  height?: number;
  className?: string;
  sizes?: string;
  priority?: boolean;
  style?: React.CSSProperties;
}

/**
 * Renders a next/image that automatically falls through a list of src URLs
 * on error. The last entry in srcs should always be a local placeholder so
 * the chain terminates with something visible.
 */
export function ImageWithFallback({
  srcs,
  alt,
  fill,
  width,
  height,
  className,
  sizes,
  priority,
  style,
}: ImageWithFallbackProps) {
  const validSrcs = srcs.filter((s) => Boolean(s) && !isKnownMissingImage(s)); // outside images known not to exist are skipped (3 Oct 2026)
  const [idx, setIdx] = useState(0);
  const src = validSrcs[idx] ?? '/fallback-hero.png';
  const isExternal = src.startsWith('http');

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      width={!fill ? width : undefined}
      height={!fill ? height : undefined}
      className={className}
      sizes={sizes}
      priority={priority}
      style={style}
      unoptimized={isExternal}
      onError={() => setIdx((i) => Math.min(i + 1, validSrcs.length - 1))}
    />
  );
}
