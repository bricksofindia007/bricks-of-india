import type { Metadata } from 'next';
import Link from 'next/link';
import { PrecisionCta } from './PrecisionCta';
import { YouTubePlayIcon, InstagramCameraIcon, GlobeStudsIcon } from './icons';

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

// Site-wide primary-button treatment (see Button.tsx variant="primary"):
// white text on the default blue, dark text on the yellow hover state --
// this page matches the rest of the site rather than being a special case.
const ctaClassName =
  'flex items-start gap-3 rounded-xl bg-primary px-5 py-4 text-white transition hover:bg-yellow-400 hover:text-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-dark';

export default function PrecisionPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12 sm:py-16">
      <p className="font-serif text-2xl font-extrabold leading-snug text-neutral-900 sm:text-3xl">
        Thank you — you've officially taken the first step towards severe
        financial irresponsibility.
      </p>
      <p className="mt-6 max-w-lg text-[15px] leading-relaxed text-neutral-700">
        While you wait, do yourself an enormous favour: subscribe on
        YouTube and follow on Instagram.
      </p>
      <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-neutral-700">
        No doctor on earth will tell you this, mostly because we didn't
        ask one. However, our own research which was verified by
        absolutely nobody, conclusively proves it cures boredom, improves
        your credit score besides several other benefits you definitely
        did not need.
      </p>
      <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-neutral-700">
        Do it now, before your name's called and this moment of clarity
        passes forever.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <PrecisionCta
          href="https://www.youtube.com/@BricksofIndia?sub_confirmation=1"
          eventName="click_subscribe_youtube"
          external
          className={ctaClassName}
        >
          <YouTubePlayIcon />
          <span>
            <span className="block text-sm font-bold">Subscribe on YouTube</span>
            <span className="mt-1 block text-xs opacity-90">
              Set reviews, unboxings, and honest opinions on LEGO in India.
              No fluff. Just bricks.
            </span>
          </span>
        </PrecisionCta>
        <PrecisionCta
          href="https://www.instagram.com/bricksofindia"
          eventName="click_follow_instagram"
          external
          className={ctaClassName}
        >
          <InstagramCameraIcon />
          <span>
            <span className="block text-sm font-bold">Follow on Instagram</span>
            <span className="mt-1 block text-xs opacity-90">
              Set photos, building updates, and borderline obsessive LEGO
              opinions at 2am.
            </span>
          </span>
        </PrecisionCta>
        <PrecisionCta
          href="/sets"
          eventName="click_compare_prices"
          className={ctaClassName}
        >
          <GlobeStudsIcon />
          <span>
            <span className="block text-sm font-bold">
              Compare Prices &amp; deals exclusively on www.BricksofIndia.com
            </span>
            <span className="mt-1 block text-xs opacity-90">
              Every set. Every store. Updated daily.
            </span>
          </span>
        </PrecisionCta>
      </div>
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
