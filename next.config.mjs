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
    ];
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.rebrickable.com' },
      { protocol: 'https', hostname: 'www.lego.com' },
      { protocol: 'https', hostname: 'images.brickset.com' },
      { protocol: 'https', hostname: 'm.media-amazon.com' },
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'img.youtube.com' },
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
        ],
      },
      // Admin — never cache
      {
        source: '/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, private' },
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
