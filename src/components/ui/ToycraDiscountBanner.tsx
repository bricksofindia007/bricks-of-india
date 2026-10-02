'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BRAND } from '@/lib/brand';

// #212 / PR-D (2026-09-26): every placement of the ABHINAV12 code links the
// affiliate disclosure. Line text changed by Abhinav (P14 round 3, 1 Oct 2026; "full-price
// sets" added 2 Oct 2026: the code doesn't apply to already-discounted Toycra items);
// the /legal/affiliate-disclosure link stays.
function Disclosure({ className }: { className?: string }) {
  return (
    <span className={className}>
      ABHINAV12 gets you 12% off full-price sets at Toycra. It’s not a fortune. But neither is your bank balance. We cannot fix everything!{' '}
      <Link href="/legal/affiliate-disclosure" className="underline hover:no-underline">Disclosure</Link>
    </span>
  );
}

interface ToycraDiscountBannerProps {
  variant?: 'full' | 'compact' | 'inline';
}

export function ToycraDiscountBanner({ variant = 'full' }: ToycraDiscountBannerProps) {
  const [copied, setCopied] = useState(false);

  const copyCode = () => {
    navigator.clipboard.writeText(BRAND.toycraCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (variant === 'inline') {
    return (
      <div className="flex items-center gap-2 bg-amber-50 border border-accent rounded-lg px-3 py-2 text-sm">
        <span className="text-xl">🎉</span>
        <span className="text-dark font-bold">Use code </span>
        <button
          onClick={copyCode}
          className="bg-accent text-dark font-bold px-2 py-0.5 rounded font-price text-sm hover:bg-accent-hover transition-colors"
        >
          {BRAND.toycraCode}
        </button>
        <span className="text-dark">for {BRAND.toycraDiscount} off full-price sets at Toycra (min. {BRAND.toycraMinOrder})</span>
        {copied && <span className="text-deal-green text-xs font-bold">✓ Copied!</span>}
        <Disclosure className="basis-full text-xs text-gray-500" />
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className="bg-accent text-dark py-2 px-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg">
        <p className="text-sm font-bold">
          🎉 Exclusive deal: <span className="font-price">{BRAND.toycraCode}</span> — {BRAND.toycraDiscount} off full-price sets at Toycra. Min {BRAND.toycraMinOrder}.
        </p>
        <button
          onClick={copyCode}
          className="shrink-0 bg-dark text-white text-xs font-bold px-3 py-1 rounded hover:bg-gray-800 transition-colors"
        >
          {copied ? '✓ Copied!' : 'Copy Code'}
        </button>
        <Disclosure className="basis-full text-xs text-dark/70" />
      </div>
    );
  }

  return (
    <div className="bg-accent py-4 px-6">
      <div className="max-w-site mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🎉</span>
          <div>
            <p className="font-bold text-dark text-lg leading-tight">
              Exclusive Bricks of India Deal at Toycra
            </p>
            <p className="text-dark text-sm">
              Use code <strong className="font-price text-base bg-dark text-accent px-2 py-0.5 rounded mx-1">{BRAND.toycraCode}</strong> for {BRAND.toycraDiscount} off full-price sets. Min. purchase {BRAND.toycraMinOrder}. No limits. Your wallet can handle it.
            </p>
            <Disclosure className="block text-dark/70 text-xs mt-1" />
          </div>
        </div>
        <button
          onClick={copyCode}
          className="shrink-0 bg-dark text-white font-bold px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors text-sm uppercase tracking-wide"
        >
          {copied ? '✓ Code Copied!' : 'Copy ABHINAV12'}
        </button>
      </div>
    </div>
  );
}
