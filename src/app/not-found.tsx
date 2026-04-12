import Image from 'next/image';
import Link from 'next/link';
import { MASCOTS } from '@/lib/brand';

export default function NotFound() {
  return (
    <div className="bg-white min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-lg">
        <Image
          src={MASCOTS.blue.confused}
          alt="404 — Page not found"
          width={200}
          height={200}
          className="mx-auto mb-6 object-contain"
        />
        <h1 className="font-heading text-dark text-6xl md:text-7xl mb-4">WELL. THIS IS AWKWARD.</h1>
        <p className="text-gray-500 font-body text-lg mb-8">
          Even LEGO can&apos;t build what you&apos;re looking for.
          The page you want either doesn&apos;t exist or has wandered off somewhere.
          Let&apos;s get you back on track.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/" className="bg-primary text-dark font-bold px-6 py-3 rounded-xl hover:bg-yellow-400 transition-colors">
            Go Home
          </Link>
          <Link href="/compare" className="bg-dark text-white font-bold px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors">
            Search Sets
          </Link>
          <Link href="/deals" className="border-2 border-dark text-dark font-bold px-6 py-3 rounded-xl hover:bg-dark hover:text-white transition-colors">
            Latest Deals
          </Link>
        </div>
      </div>
    </div>
  );
}
