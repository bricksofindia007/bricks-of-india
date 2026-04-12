'use client';

import { useState } from 'react';
import Image from 'next/image';

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
  const validSrcs = srcs.filter(Boolean);
  const [idx, setIdx] = useState(0);
  const src = validSrcs[idx] ?? '/images/lego-placeholder.svg';

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
      unoptimized
      onError={() => setIdx((i) => Math.min(i + 1, validSrcs.length - 1))}
    />
  );
}
