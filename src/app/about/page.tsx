import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { BRAND, MASCOTS } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'About Bricks of India — India\'s Honest LEGO Guide',
  description: 'Bricks of India is India\'s premier personality-led LEGO media brand. Honest reviews, price comparisons, and guides for Indian buyers.',
  alternates: { canonical: 'https://bricksofindia.com/about' },
};

export default function AboutPage() {
  return (
    <div className="bg-white min-h-screen">
      {/* Hero */}
      <section className="bg-dark py-16 px-4">
        <div className="max-w-site mx-auto flex flex-col md:flex-row items-center gap-10">
          <div className="flex-1 text-center md:text-left">
            <h1 className="font-heading text-primary text-6xl md:text-7xl mb-4">ABOUT BRICKS OF INDIA</h1>
            <p className="text-white text-xl md:text-2xl font-body italic leading-relaxed">
              "Hi, I'm Abhinav. I spend an unreasonable amount of money on small plastic bricks
              and I've decided this is your problem now."
            </p>
          </div>
          <div className="shrink-0">
            <Image
              src={MASCOTS.both.about}
              alt="Bricks of India team"
              width={350}
              height={350}
              className="object-contain drop-shadow-2xl"
            />
          </div>
        </div>
      </section>

      <div className="max-w-site mx-auto px-4 py-12">
        <div className="max-w-3xl">

          {/* Origin */}
          <section className="mb-12">
            <h2 className="font-heading text-dark text-4xl mb-4">THE STORY</h2>
            <div className="space-y-4 text-gray-600 font-body leading-relaxed text-lg">
              <p>
                Bricks of India started the way most good things do — with a genuine frustration.
                Buying LEGO in India is, to put it diplomatically, a minefield. Prices vary wildly
                between stores. Import costs are opaque. And half the time you can't tell if that
                ₹3,000 set on Amazon is genuine or a convincing plastic imposter.
              </p>
              <p>
                So I built the website I wished existed. One that compared prices honestly,
                reviewed sets without corporate filter, and talked to Indian LEGO fans like
                they were adults with functioning wallets and reasonable expectations.
              </p>
              <p>
                Bricks of India is India's honest guide to LEGO. We compare prices across
                every major Indian retailer. We review sets in plain, occasionally unhinged
                English. We tell you what's worth buying — and more importantly, what isn't.
              </p>
            </div>
          </section>

          {/* Mission */}
          <section className="mb-12 bg-primary rounded-2xl p-8">
            <h2 className="font-heading text-dark text-4xl mb-4">THE MISSION</h2>
            <div className="space-y-3 font-body text-dark text-lg">
              <p>✅ Compare LEGO prices across all major Indian stores, updated every 6 hours</p>
              <p>✅ Review sets honestly — good and bad, with actual opinions</p>
              <p>✅ Save Indian LEGO fans money with exclusive deals (hello, ABHINAV12)</p>
              <p>✅ Be genuinely useful, not just another content farm</p>
              <p>✅ Make LEGO less confusing to buy in India</p>
              <p>✅ Entertain along the way. Life's too short for boring buying guides.</p>
            </div>
          </section>

          {/* What makes BOI different */}
          <section className="mb-12">
            <h2 className="font-heading text-dark text-4xl mb-4">WHAT MAKES US DIFFERENT</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: '🏆', title: 'Honest Verdicts', desc: 'We tell you to skip sets. We say when something is overpriced. We have opinions and we share them.' },
                { icon: '💰', title: 'Price Transparency', desc: 'Real prices from real Indian stores, updated every 6 hours. Not yesterday\'s prices. Not estimates.' },
                { icon: '🇮🇳', title: 'India-First', desc: 'Everything is in ₹. We know Indian stores, Indian shipping, and Indian wallet realities.' },
                { icon: '🎬', title: 'YouTube + Website', desc: 'Video reviews AND written guides. Watch or read. We cover it both ways because you deserve options.' },
              ].map((item) => (
                <div key={item.title} className="bg-light-grey rounded-xl p-5 border-2 border-border">
                  <span className="text-3xl mb-3 block">{item.icon}</span>
                  <h3 className="font-heading text-dark text-xl mb-2">{item.title}</h3>
                  <p className="text-gray-500 font-body text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* YouTube */}
          <section className="mb-12">
            <h2 className="font-heading text-dark text-4xl mb-4">THE YOUTUBE CHANNEL</h2>
            <p className="text-gray-600 font-body mb-6 text-lg">
              Every set review is also a video. Subscribe to <strong>@BricksofIndia</strong> for unboxings,
              build reviews, and the occasional dramatic reaction to LEGO pricing decisions.
            </p>
            <a
              href={BRAND.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-secondary text-white font-bold px-6 py-3 rounded-xl hover:bg-red-700 transition-colors"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M23.5 6.2c-.3-1-1-1.8-2-2.1C19.7 3.7 12 3.7 12 3.7s-7.7 0-9.5.4c-1 .3-1.7 1.1-2 2.1C0 8 0 12 0 12s0 4 .5 5.8c.3 1 1 1.8 2 2.1C4.3 20.3 12 20.3 12 20.3s7.7 0 9.5-.4c1-.3 1.7-1.1 2-2.1C24 16 24 12 24 12s0-4-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/>
              </svg>
              Subscribe to @BricksofIndia
            </a>
          </section>

          {/* Toycra Code */}
          <section className="mb-12 bg-dark rounded-2xl p-8 text-center">
            <h2 className="font-heading text-primary text-4xl mb-3">EXCLUSIVE DEAL FOR YOU</h2>
            <p className="text-gray-300 font-body mb-4">
              Use code <strong className="font-price text-primary text-xl bg-gray-800 px-3 py-1 rounded mx-1">ABHINAV12</strong> at Toycra
              for 12% off any LEGO set. Minimum purchase ₹500. No limits. Go on.
            </p>
            <a
              href="https://www.toycra.com"
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="inline-block bg-primary text-dark font-bold px-8 py-3 rounded-xl hover:bg-yellow-400 transition-colors"
            >
              Shop at Toycra →
            </a>
          </section>

        </div>
      </div>
    </div>
  );
}
