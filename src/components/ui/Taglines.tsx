import { BRAND } from '@/lib/brand';

/**
 * TaglineChip — the primary tagline ("Every Brick Tells a Story") as a
 * navy site-tag pill. Per the brand guide, navy is the site-tag colour and
 * chips stay legible over imagery and any background. Use above hero H1s.
 * One tagline per viewport — if the chip is present, the wink yields.
 */
export function TaglineChip({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-block ${className}`}
      style={{
        fontFamily: 'var(--font-fredoka)',
        fontWeight: 600,
        fontSize: 'clamp(0.75rem, 1.6vw, 0.9rem)',
        letterSpacing: '0.4px',
        color: 'var(--boi-yellow)',
        background: 'var(--boi-navy)',
        padding: '6px 18px',
        borderRadius: '999px',
        lineHeight: 1.4,
        boxShadow: '0 2px 8px rgba(26, 35, 50, 0.25)',
      }}
    >
      {BRAND.tagline}
    </span>
  );
}

/**
 * TaglineWink — the secondary tagline ("Where Everything Is Awesome,
 * Except Financial Advice") as a brick-yellow marker highlight.
 * One treatment, every surface, light or dark — no per-page styling.
 * Codex rule: never the main lockup, never adjacent to a price verdict.
 */
export function TaglineWink({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline ${className}`}
      style={{
        fontFamily: 'var(--font-fredoka)',
        fontWeight: 500,
        fontStyle: 'italic',
        fontSize: '0.9rem',
        color: 'var(--boi-navy)',
        background: 'var(--boi-yellow)',
        padding: '3px 10px',
        borderRadius: '4px',
        lineHeight: 1.9,
        boxDecorationBreak: 'clone',
        WebkitBoxDecorationBreak: 'clone',
      }}
    >
      {BRAND.taglineSecondary}
    </span>
  );
}
