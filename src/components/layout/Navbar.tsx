'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X, Search } from 'lucide-react';
import { TricolourStripe } from '@/components/ui/TricolourStripe';

const NAV_LINKS = [
  { href: '/compare',  label: 'Sets'     },
  { href: '/themes',   label: 'Themes'   },
  { href: '/deals',    label: 'Deals'    },
  { href: '/reviews',  label: 'Reviews'  },
  { href: '/news',     label: 'News'     },
  { href: '/about',    label: 'About'    },
];

/** Wordmark lockup — shared by desktop header and mobile drawer */
function Wordmark({ size = 'md' }: { size?: 'sm' | 'md' }) {
  const bricksSize  = size === 'sm' ? '18px' : '22px';
  const indiaSize   = size === 'sm' ? '13px' : '16px';
  const outlineShadow =
    '2px 2px 0 var(--boi-navy), -1px -1px 0 var(--boi-navy), 1px -1px 0 var(--boi-navy), -1px 1px 0 var(--boi-navy)';

  return (
    <Link href="/" className="shrink-0 block" style={{ lineHeight: 0.9 }}>
      <div
        style={{
          fontFamily: 'var(--font-fredoka)',
          fontWeight: 700,
          fontSize: bricksSize,
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
          fontSize: indiaSize,
          color: '#fff',
          textShadow: outlineShadow,
          lineHeight: 1,
        }}
      >
        OF INDIA
      </div>
    </Link>
  );
}

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  // Homepage has its own full hero — suppress this header there
  if (pathname === '/') return null;

  return (
    <header
      className="sticky top-0 z-50 shadow-sm"
      style={{ background: 'linear-gradient(90deg, var(--boi-sky), var(--boi-sky-light))' }}
    >
      {/* Main nav row — ~60px desktop */}
      <div className="max-w-site mx-auto px-4">
        <div className="flex items-center gap-4" style={{ height: '60px' }}>
          {/* Left — wordmark */}
          <Wordmark size="md" />

          {/* Centre — horizontal nav (desktop only) */}
          <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    fontFamily: 'var(--font-inter)',
                    fontWeight: 600,
                    fontSize: '14px',
                    color: 'var(--boi-navy)',
                    textDecoration: active ? `underline 2px ${active ? 'var(--boi-red)' : 'transparent'}` : 'none',
                    textUnderlineOffset: '3px',
                  }}
                  className="px-3 py-1.5 rounded-lg transition-all hover:underline hover:decoration-[var(--boi-red)] hover:decoration-2 hover:underline-offset-4"
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right — CTA (desktop: text button, mobile: magnifying glass icon) */}
          <div className="ml-auto flex items-center gap-2">
            {/* Desktop CTA */}
            <Link
              href="/search"
              className="hidden md:inline-flex items-center gap-1.5 text-white font-bold text-sm px-4 py-2 rounded-xl transition-opacity hover:opacity-90"
              style={{
                background: 'var(--boi-red)',
                boxShadow: '0 2px 0 var(--boi-red-dark)',
                fontFamily: 'var(--font-fredoka)',
                fontWeight: 700,
              }}
            >
              Search sets →
            </Link>

            {/* Mobile: search icon CTA */}
            <Link
              href="/search"
              aria-label="Search sets"
              className="md:hidden p-2 rounded-lg"
              style={{ color: 'var(--boi-navy)' }}
            >
              <Search className="w-5 h-5" />
            </Link>

            {/* Mobile: hamburger */}
            <button
              className="md:hidden p-2 rounded-lg"
              style={{ color: 'var(--boi-navy)' }}
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* TricolourStripe — 4px on inner pages */}
      <TricolourStripe height={4} />

      {/* Mobile menu drawer */}
      {mobileOpen && (
        <div className="md:hidden bg-white border-t border-border shadow-lg">
          <nav className="max-w-site mx-auto px-4 py-4 flex flex-col gap-1">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                style={{
                  fontFamily: 'var(--font-inter)',
                  fontWeight: 600,
                  color: 'var(--boi-navy)',
                }}
                className="px-4 py-3 rounded-lg hover:bg-surface transition-colors text-sm"
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
