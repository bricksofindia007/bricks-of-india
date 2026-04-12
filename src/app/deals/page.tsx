import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { SetCard } from '@/components/sets/SetCard';
import { ToycraDiscountBanner } from '@/components/ui/ToycraDiscountBanner';
import { MASCOTS } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Best LEGO Deals in India Right Now | Bricks of India',
  description: 'Current best LEGO prices across all Indian stores. Price drops, exclusive codes, and the sets worth buying right now.',
  alternates: { canonical: 'https://bricksofindia.com/deals' },
};

export const revalidate = 21600; // 6 hours

export default async function DealsPage() {
  const { data: setsWithPrices } = await supabase
    .from('sets')
    .select('*, prices(*)')
    .not('prices', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(48);

  const sets = (setsWithPrices || []).filter((s: any) => {
    const p = (s.prices || []).filter((x: any) => x.is_active && x.price_inr);
    return p.length > 0;
  });

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-primary-dark py-12 px-4">
        <div className="max-w-site mx-auto flex items-center gap-6">
          <div className="flex-1">
            <h1 className="font-heading text-white text-6xl mb-2">BEST LEGO DEALS IN INDIA</h1>
            <p className="text-white/70 font-body text-lg">
              Updated every 6 hours. These are the best prices right now across all Indian stores.
              Your wallet is about to have a very complicated day.
            </p>
          </div>
          <Image src={MASCOTS.both.celebrate} alt="Deals" width={180} height={180} className="object-contain shrink-0 hidden md:block" />
        </div>
      </div>

      {/* Toycra exclusive */}
      <ToycraDiscountBanner variant="full" />

      <div className="max-w-site mx-auto px-4 py-10">
        {/* ABHINAV12 spotlight */}
        <div className="bg-accent rounded-2xl p-6 mb-10 flex flex-col md:flex-row items-center gap-6 border-2 border-amber-600">
          <div className="flex-1">
            <p className="text-dark/70 text-xs font-bold uppercase tracking-widest mb-1">Exclusive Discount Code</p>
            <h2 className="font-heading text-dark text-3xl mb-2">12% OFF AT TOYCRA</h2>
            <p className="text-dark/80 font-body mb-4">
              Use code{' '}
              <span className="inline-block font-heading text-2xl bg-dark text-accent px-4 py-1 rounded-lg mx-1 leading-tight">ABHINAV12</span>
              {' '}at Toycra for 12% off any LEGO set. Min. ₹500. No usage limits. It&apos;s basically free money. Go on.
            </p>
            <a
              href="https://www.toycra.com"
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="inline-block bg-dark text-white font-bold px-6 py-2.5 rounded-xl hover:bg-gray-800 transition-colors text-sm"
            >
              Shop Toycra Now →
            </a>
          </div>
          <Image src={MASCOTS.red.trophy} alt="Best deal" width={130} height={130} className="object-contain shrink-0" />
        </div>

        {sets.length === 0 ? (
          <div className="text-center py-16">
            <Image src={MASCOTS.blue.phone} alt="Loading" width={150} height={150} className="mx-auto mb-4 object-contain" />
            <h2 className="font-heading text-dark text-3xl mb-2">DEALS LOADING</h2>
            <p className="text-gray-400 font-body">Our price scraper is working. Check back shortly.</p>
          </div>
        ) : (
          <>
            <h2 className="font-heading text-dark text-3xl mb-6">ALL CURRENT DEALS ({sets.length} sets)</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {sets.map((set: any) => {
                const prices = (set.prices || []).filter((p: any) => p.is_active && p.price_inr);
                const bestPrice = prices.sort((a: any, b: any) => a.price_inr - b.price_inr)[0] || null;
                return <SetCard key={set.id} set={set} bestPrice={bestPrice} priceCount={prices.length} />;
              })}
            </div>
          </>
        )}

        <p className="text-xs text-gray-400 text-center mt-8 border-t border-border pt-4">
          Prices updated every 6 hours. Always verify the final price on the retailer&apos;s website.
          LEGO® is a trademark of The LEGO Group which does not sponsor or endorse this site.
        </p>
      </div>
    </div>
  );
}
