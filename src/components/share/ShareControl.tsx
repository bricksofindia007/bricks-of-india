'use client';

// One share control for every registered share target. Renders nothing while shareEnabled is off.
// Nothing is sent until the visitor taps a channel. The preview shows exactly the title and link that will be shared.
// Failure behaviour: a failed share shows a line and never blocks the page; it never claims a share was sent.

import { useState } from 'react';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { trackEvent } from '@/lib/analytics';
import { SHARE_TEXT, VISIBLE_CHANNELS, channelLink, shareEnabled, type ShareChannel, type ShareTarget } from '@/lib/share';
import { CARD_SIZES, drawShareCard, labCardCopy, labCardFileName } from '@/lib/share-card';

const LABELS: Record<ShareChannel, string> = {
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  instagram: 'Instagram',
  email: 'Email',
  copy: 'Copy link',
};

const CHANNELS = VISIBLE_CHANNELS;

export function ShareControl({ target }: { target: ShareTarget }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (!shareEnabled(FEATURE_FLAGS)) return null;

  // Server render has no window; the sheet only opens on the client, so the path is enough there.
  const url = typeof window === 'undefined' ? target.path : `${window.location.origin}${target.path}`;

  // Instagram has no link form, so the story-size card goes out as an image.
  // 1. Where the phone can share a file (navigator.share with files): the phone's share sheet opens with the card.
  // 2. Otherwise: the card is downloaded, the approved line is shown, and Instagram's web address opens in a new tab.
  // A cancelled share is not a failure. A failed draw shows the general line. Nothing is sent by the site.
  async function onInstagram() {
    try {
      const canvas = document.createElement('canvas');
      const { width, height } = CARD_SIZES.story;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('no canvas');
      drawShareCard(ctx, 'story', labCardCopy(target.title));
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
      if (!blob) throw new Error('no blob');
      const name = labCardFileName(target.id, 'story');
      const file = new File([blob], name, { type: 'image/png' });
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: target.title });
        return;
      }
      const a = document.createElement('a');
      const objectUrl = URL.createObjectURL(blob);
      a.href = objectUrl;
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      const w = window.open('https://www.instagram.com/', '_blank');
      if (w) w.opener = null;
      setNote(SHARE_TEXT.instagramFallback);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') setNote(SHARE_TEXT.failureGeneral);
    }
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
      await onInstagram();
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
        onClick={() => setOpen(true)}
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
