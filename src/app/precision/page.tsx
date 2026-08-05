import type { Metadata } from 'next';
import Link from 'next/link';
import { PrecisionCta } from './PrecisionCta';

// Hidden QR-landing page -- discoverable only via direct QR scan. Deliberately
// NOT added to sitemap.ts's static route list, never linked from anywhere in
// the codebase, and Navbar/Footer are intentionally NOT imported here: every
// route under src/app/ already gets them for free from the root layout
// (src/app/layout.tsx renders <Navbar /> / <Footer /> once around
// {children}) -- adding them again in this file would render them twice.

export const metadata: Metadata = {
  title: 'Bricks of India',
  robots: {
    index: false,
    follow: false,
  },
};

const ctaClassName =
  'block rounded-xl bg-primary px-5 py-4 text-dark transition hover:bg-yellow-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-dark';

export default function PrecisionPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
      <p className="font-serif text-2xl font-extrabold leading-snug text-neutral-900 sm:text-3xl">
        Thank you — you've officially taken the first step towards severe
        financial irresponsibility.
      </p>
      <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-neutral-700">
        Welcome to Bricks of India, where <em>Every Brick Tells a Story</em>,
        and yours is about to include several expensive ones. While you
        wait for your name to be called, here's where things get
        interesting:
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <PrecisionCta
          href="https://www.youtube.com/@BricksofIndia?sub_confirmation=1"
          eventName="click_subscribe_youtube"
          external
          className={ctaClassName}
        >
          <span className="block text-sm font-bold">Subscribe on YouTube</span>
          <span className="mt-1 block text-xs opacity-90">
            Set reviews, unboxings, and honest opinions on LEGO in India.
            No fluff. Just bricks.
          </span>
        </PrecisionCta>
        <PrecisionCta
          href="https://www.instagram.com/bricksofindia"
          eventName="click_follow_instagram"
          external
          className={ctaClassName}
        >
          <span className="block text-sm font-bold">Follow on Instagram</span>
          <span className="mt-1 block text-xs opacity-90">
            Set photos, building updates, and borderline obsessive LEGO
            opinions at 2am.
          </span>
        </PrecisionCta>
        <PrecisionCta
          href="/sets"
          eventName="click_compare_prices"
          className={ctaClassName}
        >
          <span className="block text-sm font-bold">
            Compare Prices &amp; deals exclusively on www.BricksofIndia.com
          </span>
          <span className="mt-1 block text-xs opacity-90">
            Every set. Every store. Updated daily.
          </span>
        </PrecisionCta>
      </div>
      <p className="mt-8 max-w-lg text-[15px] leading-relaxed text-neutral-700">
        Now sit back, relax, and keep an eye on the door — when your name
        is called, tell them you just discovered the shortest highway to
        financial ruin.
      </p>
      <p className="mt-6">
        <Link href="/about" className="text-sm font-semibold text-primary hover:text-primary-dark">
          Curious who's behind this? → Meet the founder
        </Link>
      </p>
      <p className="mt-10 border-t border-neutral-200 pt-5 text-xs leading-relaxed text-neutral-500">
        Side effects may include sudden urges to buy overpriced plastic.
        Good luck explaining to your family why you spent ₹30,000 on
        plastic bricks.
      </p>
    </main>
  );
}
