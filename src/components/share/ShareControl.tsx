'use client';

// One share control for every registered share target. Renders nothing while shareEnabled is off.
// Nothing is sent until the visitor taps a channel. The preview shows exactly the title and link that will be shared.
// Failure behaviour: a failed share shows a line and never blocks the page; it never claims a share was sent.

import { useState } from 'react';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { trackEvent } from '@/lib/analytics';
import { SHARE_TEXT, channelLink, shareEnabled, type ShareChannel, type ShareTarget } from '@/lib/share';

// Channel labels. Not yet owner-approved: flagged in the pull request.
const LABELS: Record<ShareChannel, string> = {
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  instagram: 'Instagram',
  email: 'Email',
  copy: 'Copy link',
};

const CHANNELS: ShareChannel[] = ['whatsapp', 'facebook', 'instagram', 'email', 'copy'];

export function ShareControl({ target }: { target: ShareTarget }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  if (!shareEnabled(FEATURE_FLAGS)) return null;

  // Server render has no window; the sheet only opens on the client, so the path is enough there.
  const url = typeof window === 'undefined' ? target.path : `${window.location.origin}${target.path}`;

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
      // No image yet, so the phone share sheet is not offered. Show the approved fallback.
      setNote(SHARE_TEXT.instagramFallback);
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
