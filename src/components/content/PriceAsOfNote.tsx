import Link from 'next/link';

/** "Prices in this article are as of {date}" plus a link to today's prices. */
export function PriceAsOfNote({ date, href }: { date: string; href: string }) {
  return (
    <p className="text-sm text-gray-500 font-body border-l-4 border-accent pl-3 mb-6">
      Prices in this article are as of {date}.{' '}
      <Link href={href} className="font-bold text-primary hover:underline">Today&apos;s prices →</Link>
    </p>
  );
}
