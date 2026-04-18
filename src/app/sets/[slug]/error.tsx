'use client';

import Link from 'next/link';

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SetPageError({ error, reset }: Props) {
  return (
    <div className="bg-white min-h-screen flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="text-6xl mb-4">🧱</div>
        <h1 className="font-heading text-dark text-3xl mb-3">Price data temporarily unavailable</h1>
        <p className="text-gray-500 font-body mb-6">
          We couldn&apos;t load price information for this set right now. Try again shortly — our
          database is updated every 6 hours.
        </p>
        <div className="flex gap-3 justify-center flex-wrap">
          <button
            onClick={reset}
            className="bg-dark text-white font-bold px-6 py-2.5 rounded-xl hover:bg-gray-800 transition-colors text-sm"
          >
            Try again
          </button>
          <Link
            href="/compare"
            className="border-2 border-dark text-dark font-bold px-6 py-2.5 rounded-xl hover:bg-light-grey transition-colors text-sm"
          >
            Browse all sets
          </Link>
        </div>
      </div>
    </div>
  );
}
