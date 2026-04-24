'use client';

interface Props {
  url: string;
}

export function CopyLinkButton({ url }: Props) {
  return (
    <button
      onClick={() => navigator.clipboard.writeText(url)}
      className="flex items-center gap-2 border-2 border-dark text-dark font-bold px-4 py-2 rounded-lg text-sm hover:bg-dark hover:text-white transition-colors"
    >
      🔗 Copy Link
    </button>
  );
}
