'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

const CHANNELS = [
  {
    name: 'WhatsApp',
    emoji: '💬',
    steps: 'Download the clip, open WhatsApp, pick a chat or status, and attach the video file like any other video.',
  },
  {
    name: 'Instagram',
    emoji: '📸',
    steps: 'Download the clip, open Instagram, start a new Story or Reel, and upload it from your gallery/downloads.',
  },
  {
    name: 'Facebook',
    emoji: '👍',
    steps: 'Download the clip, then upload it as a Facebook post or Story from your device.',
  },
  {
    name: 'LinkedIn',
    emoji: '💼',
    steps: 'Download the clip, start a new LinkedIn post, and attach the video from your device.',
  },
];

export function HowToShareModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 text-white font-bold text-sm px-4 py-2 rounded-xl transition-opacity hover:opacity-90"
        style={{
          background: 'var(--boi-navy)',
          fontFamily: 'var(--font-fredoka)',
          fontWeight: 700,
        }}
      >
        How to share →
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="How to share"
        >
          <div
            className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-2xl"
                style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, color: 'var(--boi-navy)' }}
              >
                How to share
              </h2>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="p-1 rounded-lg hover:bg-surface"
                style={{ color: 'var(--boi-navy)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="font-body text-sm text-text-secondary mb-4">
              No accounts, no linking — just download the clip you want and share it like any other video.
            </p>
            <div className="flex flex-col gap-4">
              {CHANNELS.map((c) => (
                <div key={c.name} className="flex gap-3">
                  <span className="text-2xl shrink-0" aria-hidden="true">{c.emoji}</span>
                  <div>
                    <div
                      className="text-sm font-bold"
                      style={{ fontFamily: 'var(--font-fredoka)', color: 'var(--boi-navy)' }}
                    >
                      {c.name}
                    </div>
                    <p className="font-body text-sm text-text-secondary">{c.steps}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
