// PR-E (2026-09-26): serve Rebrickable's own resized images instead of the
// full-size originals. Cards displayed at ~250px were downloading the original
// upload -- 100 KB to 6.7 MB each (10332: 6,677,052 B original vs 54,154 B at
// 250x250). Rebrickable's CDN serves resized copies at
//   https://cdn.rebrickable.com/media/thumbs/sets/<path>.jpg/<W>x<H>p.jpg
// for any https://cdn.rebrickable.com/media/sets/<path>.jpg original, so this
// costs nothing (no Cloudflare Images, no Worker invocation per image).

export type RebrickableSize = '250x250' | '1000x800';

const RB_ORIGINAL = /^https:\/\/cdn\.rebrickable\.com\/media\/sets\/(.+\.(?:jpg|jpeg|png))$/i;

/** Resized Rebrickable URL for an original set image; any other URL is returned unchanged. */
export function rebrickableResized(url: string, size: RebrickableSize): string {
  const m = url.match(RB_ORIGINAL);
  return m ? `https://cdn.rebrickable.com/media/thumbs/sets/${m[1]}/${size}p.jpg` : url;
}
