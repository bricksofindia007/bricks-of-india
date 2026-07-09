/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/search',
        destination: '/compare',
        permanent: true,
      },
      {
        source: '/sets/page/1',
        destination: '/sets',
        permanent: true,
      },
      // Duplicate-article cleanup, 2026-07-08 (VERDICT-RULE-01 / duplicate_title
      // backlog) -- these 5 news_articles rows were deleted as duplicates.
      // Selection rule: real image beats fallback image regardless of slug
      // naming; if tied, earliest published_at wins.
      {
        source: '/news/lego-darth-vader-bust-75439-worth-5499',
        destination: '/news/lego-darth-vader-bust-75439-worth-5499-2',
        permanent: true,
      },
      {
        source: '/news/lego-dinosaur-fossils-triceratops-77985-worth-10999-2',
        destination: '/news/lego-dinosaur-fossils-triceratops-77985-worth-10999',
        permanent: true,
      },
      {
        source: '/news/build-your-own-mtron-mobile-moon-base-with-free-instructions',
        destination: '/news/build-your-own-mtron-mobile-moon-base-for-free-no-set-number',
        permanent: true,
      },
      {
        source: '/news/build-your-own-mtron-moon-base-with-free-instructions',
        destination: '/news/build-your-own-mtron-mobile-moon-base-for-free-no-set-number',
        permanent: true,
      },
      {
        source: '/news/free-mtron-mobile-moon-base-moc-build-your-own-retro-rover-n',
        destination: '/news/build-your-own-mtron-mobile-moon-base-for-free-no-set-number',
        permanent: true,
      },
      {
        source: '/news/weapon-wednesday-lego-miniweapons-turn-instagram-into-a-ritu',
        destination: '/news/weapon-wednesday-tiny-lego-weapons-knolling-rituals-what-ind',
        permanent: true,
      },
      {
        source: '/news/weapon-wednesday-and-lego-rituals-what-indian-fans-need-to-k',
        destination: '/news/weapon-wednesday-tiny-lego-weapons-knolling-rituals-what-ind',
        permanent: true,
      },
      {
        source: '/news/weapon-wednesday-tiny-lego-weapons-find-a-home',
        destination: '/news/weapon-wednesday-tiny-lego-weapons-knolling-rituals-what-ind',
        permanent: true,
      },
      {
        source: '/news/lego-sega-genesis-mini-console-3500-or-a-painful-surprise',
        destination: '/news/lego-sega-genesis-mini-console-3500-or-a-wallet-meltdown',
        permanent: true,
      },
      // §2b duplicate-article cleanup, 2026-07-09 -- 6 more groups found via
      // publish-date + content comparison (not just shared image), same
      // selection rule as above. Plus one missing redirect for a duplicate
      // resolved in an earlier session but never given a redirect (Ideas
      // 21365 -- confirmed 404ing until this entry).
      {
        source: '/news/lego-ideas-21365-love-birds-seeing-the-birds-for-the-tree-wo',
        destination: '/news/lego-ideas-21365-love-birds-cute-but-does-it-make-sense-for-',
        permanent: true,
      },
      {
        source: '/news/lego-technic-42228-mclaren-f1-team-mcl39-review-too-many-car',
        destination: '/news/lego-technic-42228-mclaren-f1-team-mcl39-worth-24999',
        permanent: true,
      },
      {
        source: '/news/lego-megatron-brickheadz-your-wallet-is-safe-for-now',
        destination: '/news/lego-megatron-brickheadz-a-tiny-transformer-for-your-shelf-n',
        permanent: true,
      },
      {
        source: '/news/lego-porco-rosso-beach-hideout-moc-a-dream-build-for-your-wa',
        destination: '/news/porco-rosso-beach-hideout-fan-build-is-it-worth-the-indian-w',
        permanent: true,
      },
      {
        source: '/news/porco-rossos-hideout-your-wallet-needs-this-miyazaki-lego-bu',
        destination: '/news/porco-rosso-beach-hideout-fan-build-is-it-worth-the-indian-w',
        permanent: true,
      },
      {
        source: '/news/lego-11380-road-bike-a-2-foot-bicycle-that-costs-12400',
        destination: '/news/big-bike-energy-lego-set-11380-road-bike-rolls-in',
        permanent: true,
      },
      {
        source: '/news/woah-an-alternate-bossks-houndstooth-from-the-ucs-sailbarge-',
        destination: '/news/bossks-houndstooth-from-jabbas-sailbarge-set-75397-gets-a-cr',
        permanent: true,
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.rebrickable.com' },
      { protocol: 'https', hostname: 'rebrickable.com' },
      { protocol: 'https', hostname: 'www.lego.com' },
      { protocol: 'https', hostname: 'images.brickset.com' },
      { protocol: 'https', hostname: 'brickset.com' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'img.youtube.com' },
      { protocol: 'https', hostname: 'jaysbrickblog.com' },
      { protocol: 'https', hostname: 'bricknerd.com' },
      { protocol: 'https', hostname: 'www.brothers-brick.com' },
      { protocol: 'https', hostname: 'newelementary.com' },
    ],
  },
  async headers() {
    return [
      // Security headers — all routes
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          // CSP in report-only mode — enforcing blocked by inline GA script (tracked: GEO-AUDIT-FIX-01)
          // Move GA to non-inline before switching to Content-Security-Policy
          {
            key: 'Content-Security-Policy-Report-Only',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https:",
              "connect-src 'self' https://*.supabase.co https://www.google-analytics.com https://analytics.google.com",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
      // Admin — noindex + no-cache (defence in depth: robots.ts is politeness, header is enforcement)
      {
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive, nosnippet' },
        ],
      },
      // API routes — noindex
      {
        source: '/api/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
        ],
      },
      // Set detail + pagination — 1h fresh, 1d stale
      {
        source: '/sets/:path+',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=86400' },
        ],
      },
      // /lab index — rarely changes — 1h fresh, 1d stale
      {
        source: '/lab',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=86400' },
        ],
      },
      // Lab tool pages — 30min fresh, 1d stale
      {
        source: '/lab/:path+',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=1800, stale-while-revalidate=86400' },
        ],
      },
      // Content listing pages — 5min fresh, 1h stale
      {
        source: '/(news|blog|reviews)',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=300, stale-while-revalidate=3600' },
        ],
      },
      // Content detail pages — 30min fresh, 1d stale
      {
        source: '/(news|blog|reviews)/:path+',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=1800, stale-while-revalidate=86400' },
        ],
      },
      // Sitemap — 1h fresh
      {
        source: '/sitemap.xml',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=3600' },
        ],
      },
    ];
  },
};

export default nextConfig;
