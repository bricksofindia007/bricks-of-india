// Icons for the three /precision CTA buttons. YouTube/Instagram glyphs match
// Footer.tsx's icons exactly (same paths) for site-wide visual consistency --
// duplicated here rather than exported from Footer.tsx to keep this page's
// small dedicated-file pattern (see PrecisionCta.tsx) self-contained.

export function YouTubePlayIcon() {
  return (
    <svg className="w-6 h-6 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M23.5 6.2c-.3-1-1-1.8-2-2.1C19.7 3.7 12 3.7 12 3.7s-7.7 0-9.5.4c-1 .3-1.7 1.1-2 2.1C0 8 0 12 0 12s0 4 .5 5.8c.3 1 1 1.8 2 2.1C4.3 20.3 12 20.3 12 20.3s7.7 0 9.5-.4c1-.3 1.7-1.1 2-2.1C24 16 24 12 24 12s0-4-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z" />
    </svg>
  );
}

export function InstagramCameraIcon() {
  return (
    <svg className="w-6 h-6 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.2c3.2 0 3.6 0 4.8.1 3.2.1 4.7 1.7 4.8 4.8.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.1-1.6 4.7-4.8 4.8-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1C3.9 21.4 2.4 19.8 2.3 16.7 2.2 15.5 2.2 15.1 2.2 12s0-3.6.1-4.8C2.4 4.1 3.9 2.5 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zM12 0C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.2 4.4 2.6 6.8 7 7 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9C23.7 2.7 21.3.3 16.9.1 15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 100 12.4A6.2 6.2 0 0012 5.8zm0 10.2a4 4 0 110-8 4 4 0 010 8zm6.4-11.8a1.4 1.4 0 100 2.8 1.4 1.4 0 000-2.8z" />
    </svg>
  );
}

/**
 * Original globe-with-studs mark for the price-comparison CTA -- a plain
 * globe (circle + equator + meridian) with three small round studs across
 * the top, evenness nodding at "a world of LEGO bricks" without
 * reproducing LEGO's actual trademarked logo (no tapered-cylinder stud
 * profile, no LEGO wordmark, no red/yellow colourway tied to the brick logo).
 */
export function GlobeStudsIcon() {
  return (
    <svg className="w-6 h-6 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" viewBox="0 0 24 24" aria-hidden="true">
      {/* three studs sitting on the globe's crown */}
      <circle cx="8" cy="4.5" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="12" cy="3.7" r="1.3" fill="currentColor" stroke="none" />
      <circle cx="16" cy="4.5" r="1.3" fill="currentColor" stroke="none" />
      {/* globe */}
      <circle cx="12" cy="14" r="8" />
      <ellipse cx="12" cy="14" rx="3.2" ry="8" />
      <path d="M4 14h16" />
      <path d="M5.2 9.5h13.6M5.2 18.5h13.6" />
    </svg>
  );
}
