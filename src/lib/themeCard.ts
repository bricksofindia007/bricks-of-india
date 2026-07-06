import { THEMES } from './brand';

// THEMES is declared `as const`, so its slugs are a narrow literal union,
// not `string`. Widen explicitly here -- getThemeCardUrl() takes a plain
// `string` (any candidate slug, including ones that turn out unknown),
// and Set<LiteralUnion>.has() won't accept a broader `string` argument.
const KNOWN_SLUGS = new Set<string>(THEMES.map((t) => t.slug));

/**
 * Local theme-card image (webp). Falls back to a local default placeholder
 * if the slug isn't one of the known themes -- never a network fetch.
 */
export function getThemeCardUrl(slug: string): string {
  return KNOWN_SLUGS.has(slug) ? `/theme-cards/${slug}.webp` : '/theme-cards/_default.webp';
}

/**
 * Local theme-card image (jpg) for contexts that require a real JPEG --
 * OpenGraph/social meta images, where WebP support is inconsistent.
 */
export function getThemeCardOgUrl(slug: string): string {
  return KNOWN_SLUGS.has(slug) ? `/theme-cards/${slug}.jpg` : '/theme-cards/_default.jpg';
}
