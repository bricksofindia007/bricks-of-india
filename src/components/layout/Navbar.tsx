'use client';

import Link from 'next/link';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X, Search, ChevronDown } from 'lucide-react';
import { TricolourStripe } from '@/components/ui/TricolourStripe';
import { LAB_TOOLS } from '@/lib/lab-tools';

const NAV_LINKS = [
  { href: '/compare',  label: 'Sets'     },
  { href: '/themes',   label: 'Themes'   },
  { href: '/deals',    label: 'Deals'    },
  { href: '/reviews',  label: 'Reviews'  },
  { href: '/news',     label: 'News'     },
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

const navLinkStyle = {
  fontFamily: 'var(--font-inter)',
  fontWeight: 600,
  fontSize: '14px',
  color: 'var(--boi-navy)',
};

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [labDesktopOpen, setLabDesktopOpen] = useState(false);
  const [labMobileOpen, setLabMobileOpen] = useState(false);
  const pathname = usePathname();

  const isLabActive = pathname.startsWith('/lab');

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
            {/* Regular links (Sets → News) */}
            {NAV_LINKS.map(({ href, label }) => {
              const active = pathname === href || (href !== '/' && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    ...navLinkStyle,
                    textDecoration: active ? `underline 2px var(--boi-red)` : 'none',
                    textUnderlineOffset: '3px',
                  }}
                  className="px-3 py-1.5 rounded-lg transition-all hover:underline hover:decoration-[var(--boi-red)] hover:decoration-2 hover:underline-offset-4"
                >
                  {label}
                </Link>
              );
            })}

            {/* The Lab dropdown */}
            <div
              className="relative"
              onMouseEnter={() => setLabDesktopOpen(true)}
              onMouseLeave={() => setLabDesktopOpen(false)}
            >
              <button
                aria-haspopup="true"
                aria-expanded={labDesktopOpen}
                onClick={() => setLabDesktopOpen((v) => !v)}
                style={{
                  ...navLinkStyle,
                  textDecoration: isLabActive ? `underline 2px var(--boi-red)` : 'none',
                  textUnderlineOffset: '3px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                }}
                className="px-3 py-1.5 rounded-lg transition-all hover:underline hover:decoration-[var(--boi-red)] hover:decoration-2 hover:underline-offset-4 flex items-center gap-1"
              >
                The Lab
                <ChevronDown
                  className="w-3 h-3 transition-transform"
                  style={{ transform: labDesktopOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>

              {labDesktopOpen && (
                <div
                  className="absolute top-full left-0 mt-1 bg-white border border-border rounded-xl shadow-lg py-2 z-50"
                  style={{ minWidth: '220px' }}
                  role="menu"
                >
                  {LAB_TOOLS.map((tool) => {
                    const isLive = tool.status === 'live';
                    if (isLive && tool.href) {
                      return (
                        <Link
                          key={tool.id}
                          href={tool.href}
                          role="menuitem"
                          onClick={() => setLabDesktopOpen(false)}
                          className="flex items-center gap-2 px-4 py-2 hover:bg-surface transition-colors text-sm"
                          style={{ color: 'var(--boi-navy)', fontFamily: 'var(--font-inter)', fontWeight: 500 }}
                        >
                          <span aria-hidden="true">{tool.emoji}</span>
                          {tool.name}
                        </Link>
                      );
                    }
                    return (
                      <div
                        key={tool.id}
                        role="menuitem"
                        aria-disabled="true"
                        className="flex items-center gap-2 px-4 py-2 text-sm cursor-default"
                        style={{ color: '#999', fontFamily: 'var(--font-inter)' }}
                      >
                        <span aria-hidden="true">{tool.emoji}</span>
                        {tool.name}
                        <span className="ml-auto text-xs" style={{ color: '#bbb' }}>(soon)</span>
                      </div>
                    );
                  })}
                  <div className="border-t border-border mt-2 pt-2 px-4">
                    <Link
                      href="/lab"
                      role="menuitem"
                      onClick={() => setLabDesktopOpen(false)}
                      className="text-xs font-bold hover:underline"
                      style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-fredoka)' }}
                    >
                      See all Lab tools →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* About */}
            {(() => {
              const active = pathname === '/about';
              return (
                <Link
                  href="/about"
                  style={{
                    ...navLinkStyle,
                    textDecoration: active ? `underline 2px var(--boi-red)` : 'none',
                    textUnderlineOffset: '3px',
                  }}
                  className="px-3 py-1.5 rounded-lg transition-all hover:underline hover:decoration-[var(--boi-red)] hover:decoration-2 hover:underline-offset-4"
                >
                  About
                </Link>
              );
            })()}
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
            {/* Regular links (Sets → News) */}
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                style={{ fontFamily: 'var(--font-inter)', fontWeight: 600, color: 'var(--boi-navy)' }}
                className="px-4 py-3 rounded-lg hover:bg-surface transition-colors text-sm"
              >
                {label}
              </Link>
            ))}

            {/* The Lab — expandable section */}
            <div>
              <button
                onClick={() => setLabMobileOpen((v) => !v)}
                style={{ fontFamily: 'var(--font-inter)', fontWeight: 600, color: 'var(--boi-navy)' }}
                className="w-full text-left px-4 py-3 rounded-lg hover:bg-surface transition-colors text-sm flex items-center justify-between"
                aria-expanded={labMobileOpen}
              >
                The Lab
                <ChevronDown
                  className="w-4 h-4 transition-transform"
                  style={{ transform: labMobileOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>

              {labMobileOpen && (
                <div className="pl-4 pb-1 flex flex-col gap-0.5">
                  {LAB_TOOLS.map((tool) => {
                    const isLive = tool.status === 'live';
                    if (isLive && tool.href) {
                      return (
                        <Link
                          key={tool.id}
                          href={tool.href}
                          onClick={() => { setMobileOpen(false); setLabMobileOpen(false); }}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-lg hover:bg-surface transition-colors text-sm"
                          style={{ color: 'var(--boi-navy)', fontFamily: 'var(--font-inter)' }}
                        >
                          <span aria-hidden="true">{tool.emoji}</span>
                          {tool.name}
                        </Link>
                      );
                    }
                    return (
                      <div
                        key={tool.id}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm"
                        style={{ color: '#aaa', fontFamily: 'var(--font-inter)' }}
                      >
                        <span aria-hidden="true">{tool.emoji}</span>
                        {tool.name}
                        <span className="ml-auto text-xs">(soon)</span>
                      </div>
                    );
                  })}
                  <Link
                    href="/lab"
                    onClick={() => { setMobileOpen(false); setLabMobileOpen(false); }}
                    className="px-4 py-2.5 text-xs font-bold hover:underline"
                    style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-fredoka)' }}
                  >
                    See all Lab tools →
                  </Link>
                </div>
              )}
            </div>

            {/* About */}
            <Link
              href="/about"
              onClick={() => setMobileOpen(false)}
              style={{ fontFamily: 'var(--font-inter)', fontWeight: 600, color: 'var(--boi-navy)' }}
              className="px-4 py-3 rounded-lg hover:bg-surface transition-colors text-sm"
            >
              About
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
