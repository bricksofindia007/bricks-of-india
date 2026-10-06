import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/metadata';
import { DIWALI_SECTIONS, type DealCard } from '@/lib/diwali-sale';
import { saleInr } from '@/lib/sale-hub';

export const metadata: Metadata = buildMetadata({
  title: 'Diwali LEGO Sales in India: Brick Rush, Flipkart and Amazon',
  description: 'Three LEGO sales, one page: Brick Rush, Flipkart Big Billion Days and the Amazon Great Indian Festival. Deal cards, full lists and videos.',
  path: '/diwali-sale',
});

export const revalidate = 86400;

function Card({ card, note }: { card: DealCard; note: string }) {
  return (
    <Link href={`/sets/${card.set}`} className="block bg-white rounded-2xl border border-gray-200 hover:border-accent hover:shadow-md transition overflow-hidden">
      <div className="relative bg-white h-44">
        <Image src={card.image} alt={card.name} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-contain p-3" />
      </div>
      <div className="p-4 border-t border-gray-100">
        <p className="font-body text-dark text-sm font-semibold leading-snug mb-1">{card.name}</p>
        <p className="font-body text-gray-500 text-xs mb-2">{card.set}</p>
        <p className="font-heading text-dark text-2xl leading-none">{saleInr(card.price)}</p>
        <p className="font-body text-gray-500 text-xs mt-1"><span className="line-through">{saleInr(card.mrp)}</span> listed MRP</p>
        <p className="font-body text-gray-500 text-xs mt-2">{note}</p>
      </div>
    </Link>
  );
}

export default function DiwaliSalePage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="bg-primary-dark py-12 px-4">
        <div className="max-w-site mx-auto">
          <h1 className="font-heading text-white text-5xl md:text-6xl mb-2">DIWALI LEGO SALES</h1>
          <p className="text-white/70 font-body text-lg mb-1">Brick Rush, Flipkart and Amazon, in one place. Your wallet is about to have a very busy week.</p>
          <p className="text-white/60 font-body text-sm">Prices checked daily.</p>
          <nav className="mt-5 flex flex-wrap gap-3" aria-label="Sales">
            {DIWALI_SECTIONS.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="bg-accent text-dark font-bold text-sm px-4 py-2 rounded-xl hover:opacity-90">{s.name}</a>
            ))}
          </nav>
        </div>
      </div>

      <div className="max-w-site mx-auto px-4 py-10 space-y-14">
        {DIWALI_SECTIONS.map((s) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`}>
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h2 id={`${s.id}-h`} className="font-heading text-dark text-4xl">{s.name.toUpperCase()}</h2>
              <span className="bg-accent text-dark text-xs font-bold uppercase tracking-wide px-3 py-1 rounded-full">{s.status}</span>
            </div>
            <p className="font-body text-gray-700 mb-5 max-w-3xl">{s.blurb}</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
              {s.cards.map((c) => (<Card key={c.set} card={c} note={s.priceNote} />))}
            </div>
            <div className="flex flex-wrap gap-3">
              {s.articleHref && (
                <Link href={s.articleHref} className="bg-dark text-white font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-gray-800">{s.articleLabel} →</Link>
              )}
              {s.videoHref && (
                <a href={s.videoHref} target="_blank" rel="noopener noreferrer" className="border-2 border-dark text-dark font-bold text-sm px-5 py-2.5 rounded-xl hover:bg-gray-100">{s.videoLabel} →</a>
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
