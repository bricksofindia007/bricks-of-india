import Link from 'next/link';
import { BRAND } from '@/lib/brand';

function YouTubeIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.5 6.2c-.3-1-1-1.8-2-2.1C19.7 3.7 12 3.7 12 3.7s-7.7 0-9.5.4c-1 .3-1.7 1.1-2 2.1C0 8 0 12 0 12s0 4 .5 5.8c.3 1 1 1.8 2 2.1C4.3 20.3 12 20.3 12 20.3s7.7 0 9.5-.4c1-.3 1.7-1.1 2-2.1C24 16 24 12 24 12s0-4-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2.2c3.2 0 3.6 0 4.8.1 3.2.1 4.7 1.7 4.8 4.8.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.1-1.6 4.7-4.8 4.8-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1C3.9 21.4 2.4 19.8 2.3 16.7 2.2 15.5 2.2 15.1 2.2 12s0-3.6.1-4.8C2.4 4.1 3.9 2.5 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zM12 0C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.2 4.4 2.6 6.8 7 7 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9C23.7 2.7 21.3.3 16.9.1 15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 100 12.4A6.2 6.2 0 0012 5.8zm0 10.2a4 4 0 110-8 4 4 0 010 8zm6.4-11.8a1.4 1.4 0 100 2.8 1.4 1.4 0 000-2.8z" />
    </svg>
  );
}

export function Footer() {
  return (
    <footer className="bg-primary-dark text-white">
      <div className="max-w-site mx-auto px-4 pt-14 pb-8">

        {/* Top: logo + tagline + social icons */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6 mb-10">
          <div>
            <Link href="/" className="inline-block mb-3">
              <div className="bg-accent px-3 py-1.5 rounded-lg border-2 border-[#E09500] inline-block">
                <span className="font-heading text-dark text-xl leading-none tracking-wide">BRICKS OF INDIA</span>
              </div>
            </Link>
            <p className="text-accent font-bold text-sm mb-0.5">{BRAND.tagline}</p>
            <p className="text-white/55 text-sm font-body">India&apos;s honest LEGO price guide.</p>
          </div>

          {/* Social buttons */}
          <div className="flex items-center gap-3">
            <a
              href={BRAND.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 bg-white/10 hover:bg-[#FF0000] border border-white/15 hover:border-[#FF0000] text-white/80 hover:text-white px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200"
            >
              <span className="text-red-400 group-hover:text-white transition-colors">
                <YouTubeIcon />
              </span>
              YouTube
            </a>
            <a
              href={BRAND.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 bg-white/10 hover:bg-gradient-to-r hover:from-purple-500 hover:via-pink-500 hover:to-orange-400 border border-white/15 hover:border-transparent text-white/80 hover:text-white px-4 py-2 rounded-xl text-sm font-bold transition-all duration-200"
            >
              <span className="text-pink-400 group-hover:text-white transition-colors">
                <InstagramIcon />
              </span>
              Instagram
            </a>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 mb-10" />

        {/* Link columns */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          {/* Price Comparison */}
          <div>
            <h3 className="font-bold text-accent text-xs uppercase tracking-widest mb-4">Price Comparison</h3>
            <ul className="space-y-2.5">
              <li><Link href="/compare" className="text-sm text-white/65 hover:text-white transition-colors">All Sets</Link></li>
              <li><Link href="/deals" className="text-sm text-white/65 hover:text-white transition-colors">Best Deals</Link></li>
              <li><Link href="/themes/technic" className="text-sm text-white/65 hover:text-white transition-colors">Browse by Theme</Link></li>
              <li><Link href="/calendar" className="text-sm text-white/65 hover:text-white transition-colors">Release Calendar</Link></li>
            </ul>
          </div>

          {/* Content */}
          <div>
            <h3 className="font-bold text-accent text-xs uppercase tracking-widest mb-4">Content</h3>
            <ul className="space-y-2.5">
              <li><Link href="/reviews" className="text-sm text-white/65 hover:text-white transition-colors">Reviews</Link></li>
              <li><Link href="/news" className="text-sm text-white/65 hover:text-white transition-colors">News</Link></li>
              <li><Link href="/blog" className="text-sm text-white/65 hover:text-white transition-colors">Blog &amp; Guides</Link></li>
            </ul>
          </div>

          {/* About */}
          <div>
            <h3 className="font-bold text-accent text-xs uppercase tracking-widest mb-4">About</h3>
            <ul className="space-y-2.5">
              <li><Link href="/about" className="text-sm text-white/65 hover:text-white transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="text-sm text-white/65 hover:text-white transition-colors">Contact</Link></li>
            </ul>
          </div>

          {/* Legal + promo code */}
          <div>
            <h3 className="font-bold text-accent text-xs uppercase tracking-widest mb-4">Legal</h3>
            <ul className="space-y-2.5 mb-5">
              <li><Link href="/legal/disclaimer" className="text-sm text-white/65 hover:text-white transition-colors">Disclaimer</Link></li>
              <li><Link href="/legal/affiliate-disclosure" className="text-sm text-white/65 hover:text-white transition-colors">Affiliate Disclosure</Link></li>
              <li><Link href="/legal/privacy" className="text-sm text-white/65 hover:text-white transition-colors">Privacy Policy</Link></li>
              <li><Link href="/legal/terms" className="text-sm text-white/65 hover:text-white transition-colors">Terms of Use</Link></li>
            </ul>

            {/* Promo code block */}
            <div className="bg-accent/15 border border-accent/30 rounded-xl px-3 py-3">
              <p className="text-accent text-xs font-bold uppercase tracking-wide mb-0.5">Toycra Exclusive</p>
              <p className="font-heading text-accent text-xl leading-none mb-0.5">{BRAND.toycraCode}</p>
              <p className="text-white/55 text-xs">{BRAND.toycraDiscount} off · min {BRAND.toycraMinOrder}</p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row items-center justify-between gap-2">
          <p className="text-white/40 text-xs text-center md:text-left">
            © 2026 Bricks of India. LEGO® is a trademark of The LEGO Group which does not sponsor or endorse this site.
          </p>
          <p className="text-white/30 text-xs shrink-0">
            Prices updated every 6 hours.
          </p>
        </div>
      </div>
    </footer>
  );
}
