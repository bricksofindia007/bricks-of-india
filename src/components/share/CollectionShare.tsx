'use client';

// Share card for My Collection and the wishlist. Renders nothing while shareEnabled is off.
// The card image is drawn in this browser from the set count only. Nothing is sent anywhere: the visitor saves the
// image or passes it to their own share sheet. The preview shows the card's own words and no rupee value.
// Failure behaviour: a failed draw or share shows a line and never blocks the page; it never claims a share was sent.

import { useState } from 'react';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { SHARE_TEXT, shareEnabled } from '@/lib/share';
import { cardCopy, cardFileName, drawShareCard, CARD_SIZES, type CardKind } from '@/lib/share-card';

export function CollectionShare({ kind, count }: { kind: CardKind; count: number }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (!shareEnabled(FEATURE_FLAGS)) return null;

  async function buildCard(): Promise<Blob | null> {
    const canvas = document.createElement('canvas');
    const { width, height } = CARD_SIZES.square;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    drawShareCard(ctx, 'square', cardCopy(kind, count));
    return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
  }

  async function onSave() {
    setNote(null);
    try {
      const blob = await buildCard();
      if (!blob) throw new Error('no canvas');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = cardFileName(kind, 'square');
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setNote(SHARE_TEXT.failureGeneral);
    }
  }

  async function onShare() {
    setNote(null);
    try {
      const blob = await buildCard();
      if (!blob) throw new Error('no canvas');
      const file = new File([blob], cardFileName(kind, 'square'), { type: 'image/png' });
      if (typeof navigator.share !== 'function' || !navigator.canShare?.({ files: [file] })) {
        setNote(SHARE_TEXT.failureNoApp);
        return;
      }
      await navigator.share({ files: [file], title: SHARE_TEXT.collectionShared });
    } catch (err) {
      // The visitor closing the share sheet is not a failure worth a message.
      if ((err as Error).name !== 'AbortError') setNote(SHARE_TEXT.failureGeneral);
    }
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold"
      >
        {SHARE_TEXT.button}
      </button>

      {open && (
        <div role="dialog" aria-label={SHARE_TEXT.sheetTitle} className="mt-4 rounded-xl border border-neutral-200 p-4">
          <p className="font-semibold">{SHARE_TEXT.sheetTitle}</p>
          <p className="mt-2 text-sm">{cardCopy(kind, count).line}</p>
          <p className="mt-2 text-xs italic text-neutral-500">{SHARE_TEXT.previewCaption}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onShare} className="rounded-full border px-3 py-1 text-sm">Share the card</button>
            <button type="button" onClick={onSave} className="rounded-full border px-3 py-1 text-sm">Save the card</button>
          </div>

          {note && <p role="status" className="mt-3 text-sm">{note}</p>}

          <button type="button" onClick={() => { setOpen(false); setNote(null); }} className="mt-3 text-sm underline">
            Close
          </button>
        </div>
      )}
    </div>
  );
}
