import Link from 'next/link';

interface Props {
  publishedAt: string;
  updatedAt?: string | null;
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
export function Byline({ publishedAt, updatedAt }: Props) {
  const showUpdated =
    updatedAt && updatedAt !== publishedAt && updatedAt > publishedAt;

  return (
    <div
      className="flex flex-wrap items-center gap-1.5 text-sm mb-4"
      style={{
        fontFamily: 'var(--font-inter)',
        color: '#666',
        lineHeight: 1.5,
      }}
    >
      <span>By</span>
      <Link
        href="/about"
        className="font-semibold hover:underline"
        style={{ color: 'var(--boi-navy)' }}
      >
        Abhinav Bhargav
      </Link>
      <span style={{ color: '#ccc' }}>·</span>
      <span>Founder, Bricks of India</span>
      <span style={{ color: '#ccc' }}>·</span>
      <span>Published {formatDate(publishedAt)}</span>
      {showUpdated && (
        <>
          <span style={{ color: '#ccc' }}>·</span>
          <span>Updated {formatDate(updatedAt!)}</span>
        </>
      )}
    </div>
  );
}
