import Link from 'next/link';
import { BRAND } from '@/lib/brand';

function YouTubeIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M23.5 6.2c-.3-1-1-1.8-2-2.1C19.7 3.7 12 3.7 12 3.7s-7.7 0-9.5.4c-1 .3-1.7 1.1-2 2.1C0 8 0 12 0 12s0 4 .5 5.8c.3 1 1 1.8 2 2.1C4.3 20.3 12 20.3 12 20.3s7.7 0 9.5-.4c1-.3 1.7-1.1 2-2.1C24 16 24 12 24 12s0-4-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.2c3.2 0 3.6 0 4.8.1 3.2.1 4.7 1.7 4.8 4.8.1 1.2.1 1.6.1 4.8s0 3.6-.1 4.8c-.1 3.1-1.6 4.7-4.8 4.8-1.2.1-1.6.1-4.8.1s-3.6 0-4.8-.1C3.9 21.4 2.4 19.8 2.3 16.7 2.2 15.5 2.2 15.1 2.2 12s0-3.6.1-4.8C2.4 4.1 3.9 2.5 7.2 2.3 8.4 2.2 8.8 2.2 12 2.2zM12 0C8.7 0 8.3 0 7.1.1 2.7.3.3 2.7.1 7.1 0 8.3 0 8.7 0 12s0 3.7.1 4.9c.2 4.4 2.6 6.8 7 7 1.2.1 1.6.1 4.9.1s3.7 0 4.9-.1c4.4-.2 6.8-2.6 7-7 .1-1.2.1-1.6.1-4.9s0-3.7-.1-4.9C23.7 2.7 21.3.3 16.9.1 15.7 0 15.3 0 12 0zm0 5.8a6.2 6.2 0 100 12.4A6.2 6.2 0 0012 5.8zm0 10.2a4 4 0 110-8 4 4 0 010 8zm6.4-11.8a1.4 1.4 0 100 2.8 1.4 1.4 0 000-2.8z" />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

const outlineShadow = 'none';

function FooterWordmark() {
  return (
    <div style={{ lineHeight: 0.9 }}>
      <div
        style={{
          fontFamily: 'var(--font-fredoka)',
          fontWeight: 700,
          fontSize: '18px',
          color: 'var(--boi-saffron)',
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
          color: 'var(--boi-saffron)',
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
    <footer style={{ background: 'var(--boi-blue)', color: 'var(--boi-saffron)' }}>
      <div className="max-w-site mx-auto" style={{ padding: '48px 32px' }}>
        {/* 4-column grid desktop, 2-column tablet, stacked mobile */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-10">

          {/* Column 1 — wordmark + tagline */}
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="inline-block mb-4">
              <FooterWordmark />
            </Link>
            <p
              style={{
                fontFamily: 'var(--font-inter)',
                fontSize: '14px',
                color: 'rgba(255,247,220,0.85)',
                lineHeight: 1.5,
              }}
            >
              India&apos;s first LEGO® price comparison
            </p>
          </div>

          {/* Column 2 — pages */}
          <div>
            <h3
              style={{
                fontFamily: 'var(--font-fredoka)',
                fontWeight: 700,
                fontSize: '13px',
                color: 'var(--boi-saffron)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '16px',
              }}
            >
              Pages
            </h3>
            <ul className="space-y-2.5">
              {[
                { href: '/sets',    label: 'Sets'     },
                { href: '/themes',  label: 'Themes'   },
                { href: '/deals',   label: 'Deals'    },
                { href: '/reviews', label: 'Reviews'  },
                { href: '/news',    label: 'News'     },
                { href: '/blog',    label: 'Blog'     },
                { href: '/opinion', label: 'Opinion'  },
                { href: '/guides',  label: 'Guides'   },
                { href: '/lab',     label: 'The Lab'  },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: 'rgba(255,247,220,0.85)' }}
                    className="hover:underline transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3 — company */}
          <div>
            <h3
              style={{
                fontFamily: 'var(--font-fredoka)',
                fontWeight: 700,
                fontSize: '13px',
                color: 'var(--boi-saffron)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: '16px',
              }}
            >
              Company
            </h3>
            <ul className="space-y-2.5">
              {[
                { href: '/about',         label: 'About'   },
                { href: '/contact',       label: 'Contact' },
                { href: '/legal/privacy', label: 'Privacy' },
                { href: '/legal/terms',   label: 'Terms'   },
              ].map(({ href, label }) => (
                <li key={href}>
                  <Link
                    href={href}
                    style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: 'rgba(255,247,220,0.85)' }}
                    className="hover:underline transition-colors"
                  >
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4 — connect */}
          <div>
            <h3
              style={{
                fontFamily: 'var(--font-fredoka)',
                fontWeight: 700,
                fontSize: '13px',
                color: 'var(--boi-saffron)',
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
                style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: 'rgba(255,247,220,0.85)' }}
              >
                <YouTubeIcon />
                @BricksofIndia
              </a>
              <a
                href={BRAND.instagram}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:text-white transition-colors"
                style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: 'rgba(255,247,220,0.85)' }}
              >
                <InstagramIcon />
                @bricksofindia
              </a>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 hover:text-white transition-colors"
                style={{ fontFamily: 'var(--font-inter)', fontSize: '14px', color: 'rgba(255,247,220,0.85)' }}
              >
                <MailIcon />
                Contact
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom strip */}
        <div
          className="border-t pt-6 text-center"
          style={{ borderColor: 'rgba(255,255,255,0.2)' }}
        >
          <p
            style={{
              fontFamily: 'var(--font-inter)',
              fontSize: '12px',
              color: 'rgba(255,247,220,0.65)',
              marginBottom: '4px',
            }}
          >
            © 2026 Bricks of India. Built with LEGO® passion in Mumbai.
          </p>
          <p
            style={{
              fontFamily: 'var(--font-inter)',
              fontSize: '12px',
              color: 'rgba(255,247,220,0.5)',
            }}
          >
            LEGO® is a trademark of the LEGO Group. This site is not affiliated with or endorsed by the LEGO Group.
          </p>
        </div>
      </div>
    </footer>
  );
}
