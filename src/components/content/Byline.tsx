import Link from 'next/link';

interface Props {
  publishedAt: string;
  updatedAt?: string | null;
  /**
   * Set true when rendering on a dark background (e.g. the Reviews page's
   * bg-dark hero band). The default colors below (#666 text, --boi-navy
   * link — #1a2332, nearly black) were tuned for a light background and
   * measure ~3:1 and ~1.1:1 contrast against #1A1A1A respectively — both
   * fail WCAG AA's 4.5:1 for normal text. Confirmed live on
   * /reviews/[slug] (2026-07-09 contrast audit).
   */
  onDark?: boolean;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day:   'numeric',
    month: 'long',
    year:  'numeric',
  });
}

/**
 * E-E-A-T author byline shown below the title on every content page
 * (news, reviews, blog). Shows "Updated" only when different from published.
 */
export function Byline({ publishedAt, updatedAt, onDark = false }: Props) {
  const showUpdated =
    updatedAt && updatedAt !== publishedAt && updatedAt > publishedAt;

  // onDark colors verified against #1A1A1A (bg-dark): text
  // rgba(255,255,255,0.85) ≈ 15.9:1, link var(--color-accent) (site's
  // established saffron accent, already used for stars/CTAs on this page)
  // ≈ 8.7:1, separators rgba(255,255,255,0.4) (decorative, not text).
  const textColor = onDark ? 'rgba(255,255,255,0.85)' : '#666';
  const linkColor = onDark ? 'var(--color-accent)' : 'var(--boi-navy)';
  const sepColor  = onDark ? 'rgba(255,255,255,0.4)' : '#ccc';

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 text-sm mb-4"
      style={{
        fontFamily: 'var(--font-inter)',
        color: textColor,
        lineHeight: 1.5,
      }}
    >
      <span>By</span>
      <Link
        href="/about"
        className="font-semibold hover:underline"
        style={{ color: linkColor }}
      >
        Abhinav Bhargav
      </Link>
      <span style={{ color: sepColor }}>·</span>
      <span>Founder, Bricks of India</span>
      <span style={{ color: sepColor }}>·</span>
      <span>Published {formatDate(publishedAt)}</span>
      {showUpdated && (
        <>
          <span style={{ color: sepColor }}>·</span>
          <span>Updated {formatDate(updatedAt!)}</span>
        </>
      )}
    </div>
  );
}
