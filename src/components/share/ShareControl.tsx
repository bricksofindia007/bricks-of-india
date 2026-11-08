'use client';

// One share control for every registered share target. Renders nothing while shareEnabled is off.
// Nothing is sent until the visitor taps a channel. The preview shows exactly the title and link that will be shared.
// Failure behaviour: a failed share shows a line and never blocks the page; it never claims a share was sent.

import { useState } from 'react';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { trackEvent } from '@/lib/analytics';
import { SHARE_TEXT, VISIBLE_CHANNELS, channelLink, shareEnabled, shouldUseNativeShare, type ShareChannel, type ShareTarget } from '@/lib/share';
import { CARD_SIZES, cardFileName, drawShareCard, toolCardCopy } from '@/lib/share-card';

const LABELS: Record<ShareChannel, string> = {
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  instagram: 'Instagram',
  email: 'Email',
  copy: 'Copy link',
};

const CHANNELS = VISIBLE_CHANNELS;

// Decision 21e: draws the story-size card in the visitor's own browser and saves the PNG to their device.
// Nothing is uploaded or posted. Returns false when the browser cannot draw or save, so the page shows the failure line.
async function saveInstagramCard(title: string): Promise<boolean> {
  try {
    const { width, height } = CARD_SIZES.story;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    drawShareCard(ctx, 'story', toolCardCopy(title));
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) return false;
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = cardFileName('tool', 'story');
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    return true;
  } catch {
    return false;
  }
}

export function ShareControl({ target }: { target: ShareTarget }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (!shareEnabled(FEATURE_FLAGS)) return null;

  // Server render has no window; the sheet only opens on the client, so the path is enough there.
  const url = typeof window === 'undefined' ? target.path : `${window.location.origin}${target.path}`;

  // Decision 21a: on phones the phone's own share sheet is the first option. If it is unavailable or the visitor
  // cancels, the channel list opens as before. Called straight from the tap, so the browser allows it.
  async function onPress() {
    const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    const coarsePointer = typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
    if (shouldUseNativeShare({ canShare, coarsePointer })) {
      try {
        await navigator.share({ title: target.title, url });
        return;
      } catch {
        // Cancelled or refused: fall through to the channel list.
      }
    }
    setOpen(true);
  }

  async function onChannel(channel: ShareChannel) {
    // One tap, one event. Counts the tap, not a completed share.
    trackEvent('click_share', { page_type: target.pageType, tool: target.id, channel });
    setNote(null);

    if (channel === 'copy') {
      try {
        await navigator.clipboard.writeText(url);
        setNote(SHARE_TEXT.copied);
      } catch {
        setNote(SHARE_TEXT.failureGeneral);
      }
      return;
    }
    if (channel === 'instagram') {
      // Instagram takes the card from the visitor's own device, so the card is saved there and the visitor adds it.
      const saved = await saveInstagramCard(target.title);
      setNote(saved ? SHARE_TEXT.instagramFallback : SHARE_TEXT.failureGeneral);
      return;
    }
    const link = channelLink(channel, target.title, url);
    if (!link) return;
    if (channel === 'email') {
      // The visitor's own mail app opens. The site sends nothing and cannot detect whether one exists.
      window.location.href = link;
      return;
    }
    // WhatsApp and Facebook open a web address. A blocked pop-up or missing app shows the no-app line.
    const w = window.open(link, '_blank');
    if (!w) setNote(SHARE_TEXT.failureNoApp);
    else w.opener = null;
  }

  return (
    <div className="mt-8">
      <button
        type="button"
        onClick={onPress}
        className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold"
      >
        {SHARE_TEXT.button}
      </button>

      {open && (
        <div role="dialog" aria-label={SHARE_TEXT.sheetTitle} className="mt-4 rounded-xl border border-neutral-200 p-4">
          <p className="font-semibold">{SHARE_TEXT.sheetTitle}</p>
          <p className="mt-2 text-sm">{target.title}</p>
          <p className="break-all text-xs text-neutral-500">{url}</p>
          <p className="mt-2 text-xs italic text-neutral-500">{SHARE_TEXT.previewCaption}</p>

          <div className="mt-3 flex flex-wrap gap-2">
            {CHANNELS.map((c) => (
              <button key={c} type="button" onClick={() => onChannel(c)} className="rounded-full border px-3 py-1 text-sm">
                {LABELS[c]}
              </button>
            ))}
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
