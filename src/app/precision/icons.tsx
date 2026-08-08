// Full-color, recognizable icons for the three /precision CTA buttons.
//
// Deliberately NOT Footer.tsx's icons -- those are flat/monochrome
// (currentColor), matching the footer's small-link style. These need to
// read as distinct, colorful brand badges on a page whose whole job is to
// get someone to tap a CTA, so each icon carries its own fixed colors
// (not currentColor) and renders identically regardless of the button's
// hover state -- same as how real app icons behave.

export function YouTubeBadgeIcon() {
  return (
    <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#FF0000" />
      <path d="M9.5 8.4v7.2l6.3-3.6-6.3-3.6z" fill="#fff" />
    </svg>
  );
}

export function InstagramBadgeIcon() {
  return (
    <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <radialGradient id="precisionIgGrad" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#FDF497" />
          <stop offset="20%" stopColor="#FDF497" />
          <stop offset="45%" stopColor="#FD5949" />
          <stop offset="65%" stopColor="#D6249F" />
          <stop offset="100%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <rect width="24" height="24" rx="6" fill="url(#precisionIgGrad)" />
      <rect x="6" y="6" width="12" height="12" rx="3.5" fill="none" stroke="#fff" strokeWidth="1.4" />
      <circle cx="12" cy="12" r="3.2" fill="none" stroke="#fff" strokeWidth="1.4" />
      <circle cx="15.8" cy="8.2" r="0.75" fill="#fff" />
    </svg>
  );
}

/**
 * Original globe-with-studs mark for the price-comparison CTA -- a plain
 * globe (blue/green gradient, matching --boi-blue/--boi-green) with three
 * small yellow (--boi-yellow) studs across the top. A globe-with-studs
 * nod, not LEGO's actual logo: no tapered-cylinder stud profile, no LEGO
 * wordmark, no red/yellow brick-logo colourway.
 */
export function GlobeStudsIcon() {
  return (
    <svg className="w-6 h-6 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="precisionGlobeGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#006CB7" />
          <stop offset="100%" stopColor="#138808" />
        </linearGradient>
      </defs>
      <circle cx="8" cy="4.5" r="1.3" fill="#FFC72C" />
      <circle cx="12" cy="3.7" r="1.3" fill="#FFC72C" />
      <circle cx="16" cy="4.5" r="1.3" fill="#FFC72C" />
      <circle cx="12" cy="14" r="8" fill="url(#precisionGlobeGrad)" />
      <g stroke="#fff" strokeOpacity="0.55" strokeWidth="1" fill="none" strokeLinecap="round">
        <ellipse cx="12" cy="14" rx="3.2" ry="8" />
        <path d="M4 14h16" />
        <path d="M5.2 9.5h13.6M5.2 18.5h13.6" />
      </g>
    </svg>
  );
}
