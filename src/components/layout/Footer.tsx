import Link from 'next/link';
import { Youtube, Instagram, Mail } from 'lucide-react';
import { BRAND } from '@/lib/brand';

const outlineShadow =
  '2px 2px 0 var(--boi-navy), -1px -1px 0 var(--boi-navy), 1px -1px 0 var(--boi-navy), -1px 1px 0 var(--boi-navy)';

function FooterWordmark() {
  return (
    <div style={{ lineHeight: 0.9 }}>
      <div
        style={{
          fontFamily: 'var(--font-fredoka)',
          fontWeight: 700,
          fontSize: '18px',
          color: 'var(--boi-yellow)',
          textShadow: outlineShadow,
          lineHeight: 1,
        }}
      >
        BRICKS
      </div>
      <div
        style={{
          fontFamily: 'var(--font-fredoka)',
          fontWeight: 700,
          fontSize: '13px',
          color: '#fff',
          textShadow: outlineShadow,
          lineHeight: 1,
        }}
      >
        OF INDIA
      </div>
    </div>
  );
}

export function Footer() {
  return (
    <footer style={{ background: 'var(--boi-navy)', color: '#fff' }}>
      <div className="max-w-site mx-auto" style={{ padding: '48px 32px' }}>
        {/* 3-column grid desktop, stacked mobile */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-10">

          {/* Column 1 — wordmark + tagline */}
          <div>
            <Link href="/" className="inline-block mb-4">
              <FooterWordmark />
            </Link>
            <p
              style={{
                fontFamily: 'var(--font-inter)',
                fontSize: '14px',
                color: 'rgba(255,255,255,0.65)',
                lineHeight: 1.5,
              }}
            >
              India&apos;s first LEGO® price comparison
            </p>
          </div>

          {/* Column 2 — quick links */}
          <div>
            <h3
              style={{
                fontFamily: 'var(--font-fredoka)',
                fontWeight: 700,
                fontSize: '13px',
                color: 'var(--boi-yellow)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '16px',
              }}
            >
              Quick Links
            </h3>
            <ul className="space-y-2.5">
              {[
                { href: '/about',        label: 'About'   },
                { href: '/legal/privacy', label: 'Privacy' },
                { href: '/legal/terms',   label: 'Terms'   },
                { href: '/contact',       label: 'Contact' },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    style={{
                      fontFamily: 'var(--font-inter)',
                      fontSize: '14px',
                      color: 'rgba(255,255,255,0.65)',
                    }}
                    className="hover:text-white transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 — social + contact */}
          <div>
            <h3
              style={{
                fontFamily: 'var(--font-fredoka)',
                fontWeight: 700,
                fontSize: '13px',
                color: 'var(--boi-yellow)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '16px',
              }}
            >
              Connect
            </h3>
            <div className="flex flex-col gap-3">
              <a
                href={BRAND.youtube}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:text-white transition-colors"
                style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: 'rgba(255,255,255,0.65)' }}
              >
                <Youtube className="w-4 h-4 shrink-0" />
                @BricksofIndia
              </a>
              <a
                href={BRAND.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:text-white transition-colors"
                style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: 'rgba(255,255,255,0.65)' }}
              >
                <Instagram className="w-4 h-4 shrink-0" />
                @bricksofindia
              </a>
              <a
                href="mailto:abhinav@bricksofindia.com"
                className="inline-flex items-center gap-2 hover:text-white transition-colors"
                style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: 'rgba(255,255,255,0.65)' }}
              >
                <Mail className="w-4 h-4 shrink-0" />
                abhinav@bricksofindia.com
              </a>
            </div>
          </div>
        </div>

        {/* Bottom strip */}
        <div
          className="border-t pt-6 text-center"
          style={{ borderColor: 'rgba(255,255,255,0.12)' }}
        >
          <p
            style={{
              fontFamily: 'var(--font-inter)',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.45)',
              marginBottom: '4px',
            }}
          >
            © 2026 Bricks of India. Built with LEGO® passion in Mumbai.
          </p>
          <p
            style={{
              fontFamily: 'var(--font-inter)',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.30)',
            }}
          >
            LEGO® is a trademark of the LEGO Group. This site is not affiliated with or endorsed by the LEGO Group.
          </p>
        </div>
      </div>
    </footer>
  );
}
