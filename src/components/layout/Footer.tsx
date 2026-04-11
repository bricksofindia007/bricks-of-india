import Link from 'next/link';
import { BRAND } from '@/lib/brand';

export function Footer() {
  return (
    <footer className="bg-dark text-white mt-16">
      <div className="max-w-site mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-8">
          {/* Column 1: Brand */}
          <div className="col-span-2 md:col-span-1">
            <div className="bg-primary px-3 py-1.5 rounded-lg inline-block mb-3">
              <span className="font-heading text-dark text-xl">BRICKS OF INDIA</span>
            </div>
            <p className="text-gray-300 text-sm mb-4 font-body">{BRAND.tagline}</p>
            <div className="flex flex-col gap-2">
              <a
                href={BRAND.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-300 hover:text-primary transition-colors"
              >
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M23.5 6.2c-.3-1-1-1.8-2-2.1C19.7 3.7 12 3.7 12 3.7s-7.7 0-9.5.4c-1 .3-1.7 1.1-2 2.1C0 8 0 12 0 12s0 4 .5 5.8c.3 1 1 1.8 2 2.1C4.3 20.3 12 20.3 12 20.3s7.7 0 9.5-.4c1-.3 1.7-1.1 2-2.1C24 16 24 12 24 12s0-4-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z"/>
                </svg>
                @BricksofIndia
              </a>
              <a
                href={BRAND.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-gray-300 hover:text-primary transition-colors"
              >
                <svg className="w-5 h-5 text-pink-400" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2.2c3.2 0 3.6 0 4.8.1 3.2.1 4.7 1.7 4.8 4.8.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.1-1.6 4.7-4.8 4.8-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1C3.9 21.4 2.4 19.8 2.3 16.7 2.2 15.5 2.2 15.1 2.2 12s0-3.6.1-4.8C2.4 4.1 3.9 2.5 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zM12 0C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.2 4.4 2.6 6.8 7 7 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9C23.7 2.7 21.3.3 16.9.1 15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 100 12.4A6.2 6.2 0 0012 5.8zm0 10.2a4 4 0 110-8 4 4 0 010 8zm6.4-11.8a1.4 1.4 0 100 2.8 1.4 1.4 0 000-2.8z"/>
                </svg>
                @bricksofindia
              </a>
            </div>
          </div>

          {/* Column 2: Price Comparison */}
          <div>
            <h3 className="font-heading text-primary text-lg mb-3">Price Comparison</h3>
            <ul className="space-y-2">
              <li><Link href="/compare" className="text-sm text-gray-300 hover:text-primary transition-colors">All Sets</Link></li>
              <li><Link href="/themes/technic" className="text-sm text-gray-300 hover:text-primary transition-colors">By Theme</Link></li>
              <li><Link href="/deals" className="text-sm text-gray-300 hover:text-primary transition-colors">Best Deals</Link></li>
              <li><Link href="/calendar" className="text-sm text-gray-300 hover:text-primary transition-colors">Release Calendar</Link></li>
              <li>
                <div className="mt-2 bg-primary/20 border border-primary rounded-lg px-3 py-2">
                  <p className="text-primary text-xs font-bold uppercase tracking-wide">Exclusive Code</p>
                  <p className="font-price text-primary text-lg font-bold">ABHINAV12</p>
                  <p className="text-gray-300 text-xs">12% off at Toycra</p>
                </div>
              </li>
            </ul>
          </div>

          {/* Column 3: Content */}
          <div>
            <h3 className="font-heading text-primary text-lg mb-3">Content</h3>
            <ul className="space-y-2">
              <li><Link href="/reviews" className="text-sm text-gray-300 hover:text-primary transition-colors">Reviews</Link></li>
              <li><Link href="/news" className="text-sm text-gray-300 hover:text-primary transition-colors">News</Link></li>
              <li><Link href="/blog" className="text-sm text-gray-300 hover:text-primary transition-colors">Blog & Guides</Link></li>
              <li><Link href="/calendar" className="text-sm text-gray-300 hover:text-primary transition-colors">Release Calendar</Link></li>
            </ul>
          </div>

          {/* Column 4: About */}
          <div>
            <h3 className="font-heading text-primary text-lg mb-3">About</h3>
            <ul className="space-y-2">
              <li><Link href="/about" className="text-sm text-gray-300 hover:text-primary transition-colors">About Us</Link></li>
              <li><Link href="/contact" className="text-sm text-gray-300 hover:text-primary transition-colors">Contact</Link></li>
              <li>
                <a href={BRAND.youtube} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-300 hover:text-primary transition-colors">
                  YouTube Channel
                </a>
              </li>
              <li>
                <a href={BRAND.instagram} target="_blank" rel="noopener noreferrer" className="text-sm text-gray-300 hover:text-primary transition-colors">
                  Instagram
                </a>
              </li>
            </ul>
          </div>

          {/* Column 5: Legal */}
          <div>
            <h3 className="font-heading text-primary text-lg mb-3">Legal</h3>
            <ul className="space-y-2">
              <li><Link href="/legal/disclaimer" className="text-sm text-gray-300 hover:text-primary transition-colors">Disclaimer</Link></li>
              <li><Link href="/legal/affiliate-disclosure" className="text-sm text-gray-300 hover:text-primary transition-colors">Affiliate Disclosure</Link></li>
              <li><Link href="/legal/privacy" className="text-sm text-gray-300 hover:text-primary transition-colors">Privacy Policy</Link></li>
              <li><Link href="/legal/terms" className="text-sm text-gray-300 hover:text-primary transition-colors">Terms of Use</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-gray-700 mt-10 pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-gray-400 text-xs text-center md:text-left">
            © 2026 Bricks of India. LEGO® is a trademark of The LEGO Group which does not sponsor or endorse this site.
          </p>
          <p className="text-gray-500 text-xs">
            Prices updated every 6 hours. Always verify on store website before purchase.
          </p>
        </div>
      </div>
    </footer>
  );
}
