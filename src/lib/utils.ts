import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price);
}

// Single source of truth for a set's meta description -- threaded into both
// the <meta name="description"> tag (generateMetadata) and the Product
// JSON-LD (buildProductSchema) so they can't drift apart.
export function setMetaDescription(setName: string): string {
  return `Find the best price for ${setName} in India. Compare prices across Toycra and MyBrickHouse. Updated every 6 hours.`;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function timeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function whatsappShareUrl(text: string, url: string): string {
  const message = encodeURIComponent(`${text} ${url}`);
  return `https://wa.me/?text=${message}`;
}

export function twitterShareUrl(text: string, url: string): string {
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
}

export function stripMarkdown(text: string): string {
  return text
    .replace(/!\[.*?\]\(.*?\)/g, '')   // images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // links → label
    .replace(/#{1,6}\s/g, '')           // headings
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1') // bold/italic
    .replace(/`{1,3}[^`]*`{1,3}/g, '') // inline code / fenced
    .replace(/^\s*[-*+]\s/gm, '')       // list bullets
    .replace(/^\s*\d+\.\s/gm, '')       // ordered list
    .replace(/\n+/g, ' ')               // collapse newlines
    .trim();
}

export function readingTime(content: string): string {
  const words = content.trim().split(/\s+/).length;
  const minutes = Math.ceil(words / 200);
  return `${minutes} min read`;
}

// Route third-party CDN images through /api/img for og:image / twitter:image
// (social crawlers have no client-side fallback — see src/app/api/img/route.ts).
// Local paths and unknown hosts pass through untouched.
const PROXIED_IMG_HOSTS = new Set([
  'images.brickset.com', 'cdn.rebrickable.com', 'rebrickable.com',
  'i.ytimg.com', 'img.youtube.com', 'www.lego.com',
]);
export function socialCardImage(src: string | null | undefined): string | null {
  if (!src) return null;
  try {
    const u = new URL(src);
    if (PROXIED_IMG_HOSTS.has(u.hostname)) {
      return `https://bricksofindia.com/api/img?src=${encodeURIComponent(src)}`;
    }
  } catch { /* relative/local path — leave as-is */ }
  return src;
}
