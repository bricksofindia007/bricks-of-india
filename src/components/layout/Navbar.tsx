'use client';

import Link from 'next/link';
import { useState } from 'react';
import { SearchBar } from '@/components/ui/SearchBar';
import { BRAND, THEMES } from '@/lib/brand';

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [themesOpen, setThemesOpen] = useState(false);

  return (
    <header className="bg-white border-b-2 border-dark sticky top-0 z-50 shadow-sm">
      <div className="max-w-site mx-auto px-4">
        {/* Main nav row */}
        <div className="flex items-center gap-4 py-3">
          {/* Logo */}
          <Link href="/" className="shrink-0 flex items-center gap-2">
            <div className="bg-primary px-3 py-1.5 rounded-lg border-2 border-dark">
              <span className="font-heading text-dark text-xl leading-none tracking-wide">BRICKS OF INDIA</span>
            </div>
          </Link>

          {/* Search bar — hidden on mobile */}
          <div className="hidden md:flex flex-1 max-w-xl">
            <SearchBar size="sm" />
          </div>

          {/* Desktop nav links */}
          <nav className="hidden lg:flex items-center gap-1 ml-auto">
            <Link href="/compare" className="px-3 py-2 text-sm font-bold text-dark hover:text-accent-blue hover:bg-light-grey rounded-lg transition-colors">
              Price Comparison
            </Link>
            <Link href="/reviews" className="px-3 py-2 text-sm font-bold text-dark hover:text-accent-blue hover:bg-light-grey rounded-lg transition-colors">
              Reviews
            </Link>
            <Link href="/news" className="px-3 py-2 text-sm font-bold text-dark hover:text-accent-blue hover:bg-light-grey rounded-lg transition-colors">
              News
            </Link>
            <Link href="/blog" className="px-3 py-2 text-sm font-bold text-dark hover:text-accent-blue hover:bg-light-grey rounded-lg transition-colors">
              Blog
            </Link>
            <Link href="/deals" className="px-3 py-2 text-sm font-bold text-secondary hover:bg-red-50 rounded-lg transition-colors">
              Deals 🔥
            </Link>

            {/* Themes dropdown */}
            <div className="relative" onMouseEnter={() => setThemesOpen(true)} onMouseLeave={() => setThemesOpen(false)}>
              <button className="px-3 py-2 text-sm font-bold text-dark hover:text-accent-blue hover:bg-light-grey rounded-lg transition-colors flex items-center gap-1">
                Themes
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {themesOpen && (
                <div className="absolute top-full right-0 bg-white border-2 border-dark rounded-lg shadow-xl py-2 min-w-[200px] grid grid-cols-2 gap-1 p-3">
                  {THEMES.map((theme) => (
                    <Link
                      key={theme.slug}
                      href={`/themes/${theme.slug}`}
                      className="flex items-center gap-2 px-2 py-1.5 text-sm font-bold text-dark hover:bg-primary rounded-lg transition-colors"
                    >
                      <span>{theme.emoji}</span>
                      <span>{theme.name}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link href="/about" className="px-3 py-2 text-sm font-bold text-dark hover:text-accent-blue hover:bg-light-grey rounded-lg transition-colors">
              About
            </Link>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="ml-auto lg:hidden p-2 rounded-lg hover:bg-light-grey"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              }
            </svg>
          </button>
        </div>

        {/* Mobile search */}
        <div className="md:hidden pb-3">
          <SearchBar size="sm" />
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="lg:hidden border-t-2 border-dark bg-white">
          <nav className="max-w-site mx-auto px-4 py-4 flex flex-col gap-1">
            {[
              { href: '/compare', label: 'Price Comparison' },
              { href: '/reviews', label: 'Reviews' },
              { href: '/news', label: 'News' },
              { href: '/blog', label: 'Blog' },
              { href: '/deals', label: '🔥 Deals' },
              { href: '/calendar', label: 'Release Calendar' },
              { href: '/about', label: 'About' },
            ].map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-4 py-3 font-bold text-dark hover:bg-primary rounded-lg transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {label}
              </Link>
            ))}
            <div className="border-t border-border mt-2 pt-2">
              <p className="px-4 py-1 text-xs font-bold text-gray-400 uppercase tracking-wider">Themes</p>
              <div className="grid grid-cols-2 gap-1 mt-1">
                {THEMES.map((theme) => (
                  <Link
                    key={theme.slug}
                    href={`/themes/${theme.slug}`}
                    className="px-3 py-2 font-bold text-sm text-dark hover:bg-primary rounded-lg transition-colors flex items-center gap-2"
                    onClick={() => setMobileOpen(false)}
                  >
                    {theme.emoji} {theme.name}
                  </Link>
                ))}
              </div>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
