'use client';

interface Props {
  count: number;
}

export function PublishAllButton({ count }: Props) {
  if (count === 0) return null;

  return (
    <span style={{ fontSize: 13, color: '#6B7280' }}>
      {count} ready —{' '}
      <a
        href="https://github.com/bricksofindia007/bricks-of-india/actions/workflows/publish-drafts.yml"
        target="_blank"
        rel="noopener noreferrer"
        style={{ color: '#006CB7', fontWeight: 700, textDecoration: 'none' }}
      >
        Run publish-drafts on GitHub Actions ↗
      </a>
    </span>
  );
}
