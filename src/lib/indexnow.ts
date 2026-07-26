// IndexNow submission (replaces the Google sitemap ping, dead since
// June 2023 -- https://developers.google.com/search/blog/2023/06/sitemaps-lastmod-ping).
// Verified against current docs before implementing (2026-07-27):
// https://www.indexnow.org/documentation, https://www.indexnow.org/faq.
//
// Endpoint api.indexnow.org fans out to every participating engine (Bing,
// Yandex, Seznam, Naver, ...) from one submission -- not Google, which
// does not participate in IndexNow, but this is still the closest
// available equivalent to what the old ping tried to do.
//
// Key file: public/5e091570a177b154ef7c24d468ec59e3.txt, containing just
// the key, served at https://bricksofindia.com/5e091570a177b154ef7c24d468ec59e3.txt
// per the key-file requirement (8-128 hex/dash characters, hosted at the
// site root). The key is not a secret -- it's published at a public URL
// by design -- so it's a plain committed constant, not routed through
// getSecret()/GitHub Secrets.

const INDEXNOW_KEY = '5e091570a177b154ef7c24d468ec59e3';
const INDEXNOW_HOST = 'bricksofindia.com';
const INDEXNOW_KEY_LOCATION = `https://bricksofindia.com/${INDEXNOW_KEY}.txt`;
const INDEXNOW_ENDPOINT = 'https://api.indexnow.org/indexnow';
const MAX_URLS_PER_REQUEST = 10_000; // IndexNow bulk submission limit

export type IndexNowResult = { chunkSize: number; status: number; ok: boolean };

// Never throws -- a failed/unavailable IndexNow submission must not block
// a deploy or a publish. Chunks urlList at the documented 10,000-per-
// request maximum; logs the real status per chunk (200/202 = success per
// current docs, 202 specifically expected on a URL's first-ever
// submission while the engine verifies the key).
export async function submitToIndexNow(urls: string[]): Promise<IndexNowResult[]> {
  if (urls.length === 0) return [];

  const chunks: string[][] = [];
  for (let i = 0; i < urls.length; i += MAX_URLS_PER_REQUEST) {
    chunks.push(urls.slice(i, i + MAX_URLS_PER_REQUEST));
  }

  const results: IndexNowResult[] = [];
  for (const chunk of chunks) {
    try {
      const res = await fetch(INDEXNOW_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host: INDEXNOW_HOST,
          key: INDEXNOW_KEY,
          keyLocation: INDEXNOW_KEY_LOCATION,
          urlList: chunk,
        }),
      });
      const ok = res.status === 200 || res.status === 202;
      console.log(`[IndexNow] submitted ${chunk.length} URL(s) -- HTTP ${res.status}${ok ? '' : ' (not ok)'}`);
      results.push({ chunkSize: chunk.length, status: res.status, ok });
    } catch (err) {
      console.log(`[IndexNow] submission failed for ${chunk.length} URL(s): ${err instanceof Error ? err.message : String(err)}`);
      results.push({ chunkSize: chunk.length, status: 0, ok: false });
    }
  }
  return results;
}
