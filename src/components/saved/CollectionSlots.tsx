'use client';

import { lazy, Suspense } from 'react';
import type { SetRef } from '@/lib/my-collection';

// The heart and the add-to-collection buttons. Their code is a separate piece that is requested only when one of
// these renders. The page renders them only while the hearts flag is on, and passes that flag in (enabled). With the
// flag off nothing renders and the button code is never requested.
const HeartButton = lazy(() => import('@/components/saved/SaveButtons').then((m) => ({ default: m.HeartButton })));
const AddToCollectionButton = lazy(() => import('@/components/saved/SaveButtons').then((m) => ({ default: m.AddToCollectionButton })));

export function HeartSlot({ enabled, size, ...ref }: SetRef & { enabled: boolean; size?: 'sm' | 'lg' }) {
  if (!enabled) return null;
  return (
    <Suspense fallback={null}>
      <HeartButton size={size} {...ref} />
    </Suspense>
  );
}

export function CollectionSlot({ enabled, ...ref }: SetRef & { enabled: boolean }) {
  if (!enabled) return null;
  return (
    <Suspense fallback={null}>
      <AddToCollectionButton {...ref} />
    </Suspense>
  );
}
