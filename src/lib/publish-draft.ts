import { lintDraft, extractSetNumberCandidates, type LintResult } from './lint';
import { linkFirstSetMentions } from './link-set-mentions';
import { submitToIndexNow } from './indexnow';
import type { SupabaseClient } from '@supabase/supabase-js';

// ── Unified publish-a-draft logic (2026-06-28) ────────────────────────────────
//
// Extracted and merged from two independently-drifted implementations:
//   - scripts/publish-drafts.mjs (cron, 3x/day)
//   - src/app/admin/pending/actions.ts::publishOneDraft (manual "Publish" button)
//
// MEDIUM-38 (opinion path: /blog vs /opinion) was the first symptom found of
// these diverging; a closer read found more: publish-drafts.mjs had
// prePublishAutoFix(), cqsHardCheck(), EDITORIAL_CDN_BLOCKLIST, review-format
// verdict/set_number columns (feeds buildReviewSchema() JSON-LD), and a
// lint_result freshness cache that actions.ts lacked entirely. actions.ts had
// sendLintAlert() email alerting, a stricter Gate 4 hero-image check, and a
// more complete YouTube hero-image fallback chain (theme-keyword search +
// image-conflict re-resolution via sets.image_url) that publish-drafts.mjs
// lacked. Neither file was strictly more complete — each had gained real,
// independent improvements the other never received. This module merges both
// rather than picking one as canonical.
//
// Decisions made resolving the conflicts (confirmed with Abhinav):
//   - Hero image: NEVER block publish on a missing/broken image, and NEVER
//     publish with no image. The old Gate-4-hard-fail behavior (actions.ts)
//     and old silent-null behavior (publish-drafts.mjs) are both replaced:
//     every resolution path ends in applyHeroFallback(), which guarantees a
//     non-null hero_image (falling back to '/fallback-hero.png', the same
//     asset already used as the universal fallback in ImageWithFallback.tsx
//     and the news/blog detail pages) before the row is ever inserted.
//   - Opinion path: '/opinion' (MEDIUM-38 fix), not '/blog' — see resolveTarget.
//   - Review verdict/set_number columns: always populated for review-format
//     drafts (publish-drafts.mjs's behavior — actions.ts was missing this).
//   - lint_result freshness cache: kept (publish-drafts.mjs's behavior) —
//     skip re-lint if a stored, passing lint_result is <24h old; avoids a
//     redundant live factuality DB query on every publish.
//   - sendLintAlert and revalidatePath are both OPTIONAL callbacks (not hard
//     dependencies of this module), since: (a) sendLintAlert uses Resend and
//     is only meaningful for a single manual publish, not a generation-loop
//     reject+delete (would spam email on every batch failure); (b)
//     revalidatePath only works inside a Next.js Server Action request
//     context — calling it from a standalone script throws. Callers that
//     have these available (actions.ts) pass them in; callers that don't
//     (publish-drafts.mjs, generate-approved-drafts.ts) omit them and get a
//     no-op.

export const UA = 'BricksOfIndia-RadarBot/1.0 (+https://bricksofindia.com)';

const YOUTUBE_SRC_RE = /youtube\.com|youtu\.be/i;
const YOUTUBE_IMG_RE = /ytimg\.com|yt3\.ggpht\.com|youtube\.com\/vi\//i;
const HERO_FALLBACK   = '/fallback-hero.png';

const EDITORIAL_CDN_BLOCKLIST = new Set([
  'static1.squarespace.com',       // New Elementary
  'media-cdn.brothers-brick.com',  // Brothers Brick
  'live.staticflickr.com',         // Flickr embeds
  'jaysbrickblog.com',             // Jay's Brick Blog
  'cdn.bricklink.com',             // BrickLink
  'i.imgur.com',                   // Imgur
  'external-preview.redd.it',      // Reddit preview
  'preview.redd.it',               // Reddit preview
]);

const LEGO_THEME_KEYWORDS = [
  'Technic', 'City', 'Star Wars', 'Harry Potter', 'Ideas', 'Icons', 'Creator', 'Ninjago',
  'Friends', 'Marvel', 'DC', 'Disney', 'Minecraft', 'Speed Champions', 'Architecture',
  'Botanical', 'BrickHeadz', 'Duplo', 'Monkie Kid', 'Jurassic World', 'Super Mario',
  'Dreamzzz', 'Classic', 'Seasonal', 'DOTS', 'Dimensions', 'Hidden Side',
];

// ── Pre-publish auto-fix + CQS gate (from publish-drafts.mjs; actions.ts had neither) ──

const FORBIDDEN_SUBS: [RegExp, string][] = [
  [/\ba testament to\b/gi,         'proof of'],
  [/\ba testament\b/gi,            'a sign'],
  [/\btestament\b/gi,              'proof'],
  [/\bwhimsical\b/gi,              'playful'],
  [/\bpinnacle\b/gi,               'peak'],
  [/\baficionados\b/gi,            'fans'],
  [/\benthusiasts\b/gi,            'fans'],
  [/\bdelve\b/gi,                  'dig into'],
  [/\butilize\b/gi,                'use'],
  [/\bat the end of the day\b/gi,  'ultimately'],
  [/\bunadulterated\b/gi,          'pure'],
  [/\bsiren call\b/gi,             'pull'],
  [/\bfever dreams\b/gi,           'wild visions'],
  [/\bbloke\b/gi,                  'person'],
  [/\bcognoscenti\b/gi,            'experts'],
];

const JAIMAN_SUBS: [RegExp, string][] = [
  [/MyBrickHouse,\s*Toycra,\s*and\s*Jaiman\s*Toys/gi, 'MyBrickHouse and Toycra'],
  [/Toycra,\s*and\s*Jaiman\s*Toys/gi,                 'Toycra'],
  [/MyBrickHouse\s*and\s*Jaiman\s*Toys/gi,             'MyBrickHouse and Toycra'],
  [/,?\s*and\s*Jaiman\s*Toys/gi,                       ''],
  [/Jaiman\s*Toys/gi,                                  'Toycra'],
];

const SIGNOFF_TEXT = 'On that bombshell, bubyee.';

const BAD_OPENER_PATTERNS = [
  /^(Okay,\s*[^.!?]*[.!?])\s*/i,
  /^(Alright,\s*(LEGO\s*)?(fans?|everyone|Potterheads|fellow)[^.!?]*[.!?])\s*/i,
  /^(So,\s*[a-z][^.!?]*[.!?])\s*/i,
  /^(Hey\s+everyone[^.!?]*[.!?])\s*/i,
];

export function prePublishAutoFix(body: string, draft: { source_title?: string | null; draft_title?: string | null }, slug = ''): string {
  let c = body;

  c = c.replace(/\*\*([^*\n]{1,200})\*\*/g, '$1');
  c = c.replace(/(?<!\*)\*(?!\*)([^*\n]{1,200})(?<!\*)\*(?!\*)/g, '$1');
  c = c.replace(/^#{1,6}\s+(.+)$/gm, '$1');
  c = c.replace(/^(\s*)[-*]\s+/gm, '$1');

  while (c.includes('  ')) c = c.replace(/  /g, ' ');

  for (const [re, sub] of JAIMAN_SUBS) c = c.replace(re, sub);
  for (const [re, sub] of FORBIDDEN_SUBS) c = c.replace(re, sub);

  for (const pat of BAD_OPENER_PATTERNS) {
    if (pat.test(c)) {
      const title = draft?.source_title || draft?.draft_title || '';
      const setRef = title ? title.replace(/^LEGO\s*/i, '').replace(/[–—-].*$/, '').trim() : 'this set';
      const replacement = `The ${setRef} has landed — and your wallet already knows what's coming. `;
      c = c.replace(pat, replacement);
      break;
    }
  }

  if (/Toycra/i.test(c) && !/ABHINAV12/i.test(c)) {
    c = c.replace(/(Toycra\b[^.\n]*\.)/, '$1 Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.');
  }

  const hasPrice = /₹[\d,]+/.test(c);
  const hasStore = /MyBrickHouse|Toycra/i.test(c);
  if (hasPrice && !hasStore) {
    c = c.replace(/(₹[\d,]+[^.\n]*\.)/, '$1 Available at MyBrickHouse and Toycra (use code ABHINAV12 for 12% off above ₹500).');
  }

  const hasVerdict = /\b(BUY NOW|WAIT|IMPORT ONLY|AVOID)\b/.test(c);
  const hasSetNum = /\b\d{4,6}\b/.test(slug);
  if (hasPrice && !hasVerdict && hasSetNum) {
    c = c.replace(/\s+$/, '') + '\n\n**Verdict: WAIT** — check prices at MyBrickHouse and Toycra before pulling the trigger.';
  }

  if (!/on that bombshell/i.test(c)) c = c.replace(/\s+$/, '') + '\n\n' + SIGNOFF_TEXT;

  return c;
}

const CQS_HARD: { re: RegExp; msg: string }[] = [
  { re: /<script[\s>]|<iframe[\s>]/i, msg: 'script/iframe injection in body' },
  { re: /BOI_DRAFT_START|BOI_DRAFT_END/, msg: 'draft marker leaked into published body' },
];

export function cqsHardCheck(body: string): string | null {
  for (const { re, msg } of CQS_HARD) {
    if (re.test(body)) return msg;
  }
  return null;
}

// ── Slug + target resolution ──────────────────────────────────────────────────

export function generateSlug(title: string): string {
  return (title || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

// MEDIUM-38 (fixed 2026-06-28): opinion -> '/opinion', not '/blog'. Verified
// live: src/app/blog/page.tsx excludes category='Opinion' from its own
// listing; src/app/opinion/page.tsx requires it. '/blog' would have published
// successfully but been orphaned — unreachable from any listing page.
export function resolveTarget(format: string): { table: string; path: string; category: string } {
  if (format === 'guide')   return { table: 'guides',   path: '/guides',  category: 'Guide'   };
  if (format === 'opinion') return { table: 'blog_posts', path: '/opinion', category: 'Opinion' };
  // MEDIUM-13/AUDIT-NEW-3 (decided 2026-07-05): future review-format drafts
  // route to the dedicated `reviews` table + /reviews/[slug], not /news. The
  // 36 already-published /news reviews stay where they are — not migrated.
  if (format === 'review')  return { table: 'reviews',   path: '/reviews', category: 'Review'  };
  return                           { table: 'news_articles', path: '/news', category: 'News'    };
}

// Verdict -> star rating, decided 2026-07-05 alongside the reviews-routing
// change, and always acknowledged as an interim stopgap (see the original
// comment this replaces): a rating mechanically derived from price verdict
// misstates the thing a rating is supposed to measure. Confirmed live
// 2026-07-09 across all 18 published reviews: rating tracked verdict with
// essentially zero independent variation, regardless of piece count, build
// quality, or design merit. Superseded by an independent RATING field the
// model now produces directly (draft-prompt.ts RATING CRITERIA) — this map
// is kept ONLY as a fallback for drafts approved before this fix shipped
// (draft_rating absent), not as the primary path.
const VERDICT_TO_RATING: Record<string, number | null> = {
  'BUY NOW': 5,
  'WAIT': 3,
  'IMPORT ONLY': null,
  'AVOID': 1,
};

// ── Hero image resolution ─────────────────────────────────────────────────────

export function isEditorialCDN(url: string | null): boolean {
  if (!url) return false;
  try { return EDITORIAL_CDN_BLOCKLIST.has(new URL(url).hostname); }
  catch { return false; }
}

export async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const html = await res.text();
    const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                 || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    const twMatch = html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i)
                 || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i);
    const og = ogMatch?.[1] || twMatch?.[1];
    return (og && og.startsWith('http')) ? og : null;
  } catch { return null; }
}

// Non-model Rebrickable categories that pollute set-number and theme-search
// matches with plausible-looking-but-wrong images. Confirmed wrong-image
// incidents (2026-07-08): Stickers, a Technic pneumatic part, an Educational
// "Mosaic Set" (theme "Duplo and Explore"), an Alpha Pen Pack (Stationery),
// 4 Books-category ISBN hits, a Mindstorms hub component, and a Houseware
// lunch bag reached via a 9-digit non-set-number id. Rebrickable models
// every real LEGO product, not just building sets, so a numeric match
// against `sets` can land on any of these instead.
const DISALLOWED_REBRICKABLE_THEMES = [
  'gear', 'book', 'sticker', 'service pack', 'stationery',
  'duplo', 'explore', 'houseware', 'mindstorms', 'powered up',
];
const themeNameCache = new Map<number, string | null>();

async function isDisallowedRebrickableSet(
  setNum: string,
  themeId: number | undefined,
  numParts: number | undefined,
  rbHdrs: Record<string, string>,
): Promise<boolean> {
  // LEGO set numbers are never 13 digits — that pattern is Rebrickable's
  // ISBN-format id for Books-category entries.
  if (/^\d{13}$/.test(setNum.split('-')[0])) return true;

  // A real buildable set always has parts. Zero parts reliably flags
  // merchandise (lunch bags, apparel) and other non-model catalog entries
  // that a plain numeric or theme-keyword match can still surface —
  // preferring the honest fallback image over a confident-looking wrong one.
  if (numParts === 0) return true;

  if (themeId == null) return false;
  let themeName = themeNameCache.get(themeId);
  if (themeName === undefined) {
    try {
      const res = await fetch(
        `https://rebrickable.com/api/v3/lego/themes/${themeId}/`,
        { headers: rbHdrs, signal: AbortSignal.timeout(5000) },
      );
      themeName = res.ok ? ((await res.json() as { name?: string }).name ?? null) : null;
    } catch { themeName = null; }
    themeNameCache.set(themeId, themeName);
  }
  if (!themeName) return false;
  const lower = themeName.toLowerCase();
  return DISALLOWED_REBRICKABLE_THEMES.some(bad => lower.includes(bad));
}

// Resolves a Rebrickable theme_id to its name, walking one level up via
// parent_id if present (covers common subtheme cases, e.g. a UCS/Trains
// subtheme whose own name doesn't repeat the parent theme's name).
async function resolveThemeNames(themeId: number, rbHdrs: Record<string, string>): Promise<string[]> {
  const names: string[] = [];
  try {
    const res = await fetch(`https://rebrickable.com/api/v3/lego/themes/${themeId}/`, { headers: rbHdrs, signal: AbortSignal.timeout(5000) });
    if (!res.ok) return names;
    const data = await res.json() as { name?: string; parent_id?: number | null };
    if (data.name) names.push(data.name);
    if (data.parent_id != null) {
      const pRes = await fetch(`https://rebrickable.com/api/v3/lego/themes/${data.parent_id}/`, { headers: rbHdrs, signal: AbortSignal.timeout(5000) });
      if (pRes.ok) {
        const pData = await pRes.json() as { name?: string };
        if (pData.name) names.push(pData.name);
      }
    }
  } catch { /* best-effort */ }
  return names;
}

// A theme-keyword search match is only accepted if the RESULT's own theme
// (or its immediate parent theme) actually corresponds to the keyword that
// was searched — not just because the search string happened to appear
// somewhere in the result's name. Confirmed live failure without this check
// (2026-07-08): searching theme keyword "City" (from "LEGO City") matched
// Rebrickable set 21064-1 "Paris – City of Love" — a real, correctly-
// categorized Architecture set with zero relation to the LEGO City theme,
// matched purely because the string "City" appears in its name. A
// well-formed, real, non-disallowed-category match is not sufficient on its
// own; it must also be topically the right thing.
async function themeVerifiedMatch(themeId: number | undefined, searchedKeyword: string, rbHdrs: Record<string, string>): Promise<boolean> {
  if (themeId == null) return false;
  const names = await resolveThemeNames(themeId, rbHdrs);
  const keywordLower = searchedKeyword.toLowerCase();
  return names.some(n => n.toLowerCase() === keywordLower || n.toLowerCase().includes(keywordLower));
}

// Two valid paths only, per the 2026-07-08 root-cause fix — no image match
// is ever accepted on keyword overlap alone:
//   1. Article has a set_number (via extractSetNumberCandidates' precise
//      contextual patterns — "LEGO 1234", "#1234", "(1234)", etc. — NOT a
//      blind scan of every 4-6 digit number in free text, which picks up
//      piece counts, prices, and years). Only that exact set_number's own
//      page is tried; no fuzzy/closest-match searching, no theme fallback
//      if it doesn't resolve to a valid image.
//   2. Article has no set_number (MOC, roundup, editorial) → theme-keyword
//      search is allowed, but a hit is only accepted if its own Rebrickable
//      theme (themeVerifiedMatch) actually corresponds to the searched
//      keyword. If nothing verifies, the honest fallback placeholder is the
//      correct outcome, not a failure state.
export async function resolveYouTubeHeroImage(
  title: string | null,
  body: string | null,
): Promise<string | null> {
  const rbKey  = process.env.REBRICKABLE_API_KEY;
  const rbHdrs: Record<string, string> = { 'User-Agent': UA, ...(rbKey ? { Authorization: `key ${rbKey}` } : {}) };
  const combined = `${title ?? ''} ${body ?? ''}`;

  const setNumberCandidates = extractSetNumberCandidates(combined);
  if (setNumberCandidates.length > 0) {
    for (const num of setNumberCandidates.slice(0, 3)) {
      try {
        const res = await fetch(
          `https://rebrickable.com/api/v3/lego/sets/${num}-1/`,
          { headers: rbHdrs, signal: AbortSignal.timeout(5000) },
        );
        if (res.ok) {
          const data = await res.json() as { set_num?: string; set_img_url?: string; theme_id?: number; num_parts?: number };
          if (data.set_img_url) {
            if (await isDisallowedRebrickableSet(data.set_num ?? `${num}-1`, data.theme_id, data.num_parts, rbHdrs)) {
              console.log(`[publish:hero] set ${num} rejected — disallowed category/ISBN match`);
              continue;
            }
            console.log(`[publish:hero] set ${num} (exact) → ${data.set_img_url.slice(0, 70)}`);
            return data.set_img_url;
          }
        }
      } catch { /* try next candidate */ }
    }
    // Article has a declared set_number but none resolved to a valid image —
    // per the fix, do NOT fall through to a broader theme search.
    console.log('[publish:hero] article has set_number candidates but none resolved — no theme-search fallback');
    return null;
  }

  const titleLower = (title ?? '').toLowerCase();
  const theme = LEGO_THEME_KEYWORDS.find(t => titleLower.includes(t.toLowerCase()));
  if (theme) {
    try {
      const res = await fetch(
        `https://rebrickable.com/api/v3/lego/sets/?search=${encodeURIComponent(theme)}&ordering=-year&page_size=5`,
        { headers: rbHdrs, signal: AbortSignal.timeout(5000) },
      );
      if (res.ok) {
        const data = await res.json() as { results?: Array<{ set_num?: string; set_img_url?: string; theme_id?: number; num_parts?: number }> };
        for (const hit of data.results ?? []) {
          if (!hit.set_img_url) continue;
          if (await isDisallowedRebrickableSet(hit.set_num ?? '', hit.theme_id, hit.num_parts, rbHdrs)) continue;
          if (!(await themeVerifiedMatch(hit.theme_id, theme, rbHdrs))) {
            console.log(`[publish:hero] theme "${theme}" candidate rejected — result's own theme doesn't verify (set ${hit.set_num})`);
            continue;
          }
          console.log(`[publish:hero] theme "${theme}" (verified) → ${hit.set_img_url.slice(0, 70)}`);
          return hit.set_img_url;
        }
      }
    } catch { /* fall through */ }
  }

  console.log('[publish:hero] no image resolved via Rebrickable chain');
  return null;
}

// Resolves a hero image through the full chain (OG → YouTube/CDN-block →
// Rebrickable set/theme lookup → image-conflict re-resolution) and GUARANTEES
// a non-null result. Policy locked 2026-06-28 (Abhinav): "if there is no
// publishing image available at source, use the default LEGO hero image,
// everything has to publish with an image" — no exceptions, no early-return
// path skips this. This replaces both the old hard-fail-on-broken-image
// behavior (actions.ts Gate 4) and the old silent-omit-from-insert behavior
// (both files, when heroImage ended up null/falsy at insert time).
export async function resolveHeroImage(
  sourceUrl: string,
  draftTitle: string | null,
  sourceTitle: string | null,
  draftBody: string | null,
  table: string,
  supabase: SupabaseClient,
): Promise<string> {
  let heroImage = await fetchOgImage(sourceUrl);

  if (YOUTUBE_SRC_RE.test(sourceUrl) || (heroImage !== null && YOUTUBE_IMG_RE.test(heroImage))) {
    console.log('[publish:hero] YouTube source — running Rebrickable fallback chain');
    heroImage = await resolveYouTubeHeroImage(draftTitle, draftBody ?? sourceTitle);
  } else if (isEditorialCDN(heroImage)) {
    console.log(`[publish:hero] editorial CDN blocked (${heroImage ? new URL(heroImage).hostname : 'unknown'}) — running Rebrickable fallback chain`);
    heroImage = await resolveYouTubeHeroImage(draftTitle, draftBody ?? sourceTitle);
  }

  // HTTP check on whatever we have (skip for already-local paths like a
  // prior fallback). Never hard-fails the publish — a broken image just
  // continues toward the final fallback below.
  if (heroImage && !heroImage.startsWith('/')) {
    try {
      const imgRes = await fetch(heroImage, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      if (!imgRes.ok) {
        console.log(`[publish:hero] HTTP ${imgRes.status} on resolved image — discarding, will fall back`);
        heroImage = null;
      }
    } catch {
      heroImage = null;
    }
  }

  // Image-conflict re-resolution: if the resolved image is already used by
  // another row in the same table, try the catalogue's own set image before
  // giving up (merged from actions.ts's more complete chain).
  if (heroImage && !heroImage.startsWith('/')) {
    const { data: imgConflict } = await supabase.from(table).select('id').eq('hero_image', heroImage).maybeSingle();
    if (imgConflict) {
      heroImage = null;
      const setNum = extractSetNumberCandidates(`${draftTitle ?? ''} ${sourceTitle ?? ''}`)[0];
      if (setNum) {
        const { data: setRow } = await supabase.from('sets').select('image_url').eq('set_number', setNum).maybeSingle();
        const candidate = (setRow as { image_url?: string } | null)?.image_url ?? null;
        if (candidate) {
          const { data: fallbackConflict } = await supabase.from(table).select('id').eq('hero_image', candidate).maybeSingle();
          if (!fallbackConflict) {
            try {
              const fbRes = await fetch(candidate, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
              if (fbRes.ok) heroImage = candidate;
            } catch { /* drop to final fallback */ }
          }
        }
      }
    }
  }

  // Final, unconditional floor: every published row gets an image.
  return heroImage || HERO_FALLBACK;
}

// ── Lint summary (for alerts / logs) ──────────────────────────────────────────

export function summarizeFailReasons(lint: LintResult): string {
  return [
    lint.gates.wordCount,
    lint.gates.indiaParagraph,
    lint.gates.verdict,
    lint.gates.factuality,
    lint.gates.sourceFidelity,
    lint.gates.openerUniqueness,
    lint.gates.duplicateContent,
  ]
    .filter((g): g is NonNullable<typeof g> => g !== null && g.severity === 'fail')
    .map(g => g.reason ?? 'gate failure')
    .join('; ') || 'lint failed';
}

// ── Core orchestration ────────────────────────────────────────────────────────

export type PublishableDraft = {
  id: string;
  draft_title: string | null;
  draft_body: string | null;
  draft_verdict: string | null;
  draft_rating?: number | null;
  draft_format: string | null;
  word_count: number | null;
  source_url: string;
  source_title: string | null;
  source_excerpt: string | null;
  lint_result?: LintResult | null;
  updated_at?: string | null;
};

export type PublishOneDraftOptions = {
  /** Skip a fresh re-lint if a stored, passing lint_result is younger than this. Default 24h, matches publish-drafts.mjs's prior behavior. Pass 0 to always re-lint. */
  lintFreshnessMs?: number;
  /** Called once if lint fails, before throwing. Optional — omit in batch/generation contexts to avoid spamming alerts per-failure. */
  onLintFail?: (draftTitle: string, gateMessage: string) => Promise<void>;
  /** Called once after a successful publish, with the published path. Optional — only meaningful inside a Next.js Server Action request context. */
  onPublished?: (path: string) => void;
};

export class LintFailedError extends Error {
  constructor(public readonly gateMessage: string) {
    super(gateMessage);
    this.name = 'LintFailedError';
  }
}

const DEFAULT_LINT_FRESHNESS_MS = 24 * 60 * 60 * 1000;

// Shared core, called by the cron (publish-drafts.mjs), the admin manual-publish
// button (actions.ts), and generate-approved-drafts.ts's news auto-publish path.
// Throws LintFailedError on a genuine lint failure (caller decides what that
// means for its own draft: failed_lint status, reject+delete, etc.) — never
// silently skips a draft.
export async function publishOneDraft(
  draft: PublishableDraft,
  supabase: SupabaseClient,
  options: PublishOneDraftOptions = {},
): Promise<{ path: string; slug: string; table: string; reviewVerdict: string | null; reviewSetNumber: string | null }> {
  if (!draft.draft_body) throw new Error('Draft has no generated body');

  const freshnessMs = options.lintFreshnessMs ?? DEFAULT_LINT_FRESHNESS_MS;
  const storedFresh = freshnessMs > 0
    && draft.lint_result?.overallPass === true
    && draft.updated_at
    && (Date.now() - new Date(draft.updated_at).getTime()) < freshnessMs;

  const lint: LintResult = storedFresh
    ? draft.lint_result!
    : await lintDraft(
        {
          format:     draft.draft_format || 'news',
          body:       draft.draft_body || '',
          word_count: draft.word_count,
          verdict:    draft.draft_verdict,
          title:      draft.draft_title,
          source: {
            source_url:     draft.source_url,
            source_title:   draft.source_title,
            source_excerpt: draft.source_excerpt,
          },
        },
        { supabase },
      );

  if (lint.warnings.length > 0) console.warn('[publish lint]', lint.warnings.join(' | '));

  if (!lint.overallPass) {
    const gateMsg = summarizeFailReasons(lint);
    if (options.onLintFail) await options.onLintFail(draft.draft_title || draft.source_title || 'Untitled', gateMsg);
    throw new LintFailedError(gateMsg);
  }

  const format = draft.draft_format || 'news';
  const { table, path, category } = resolveTarget(format);
  const title    = draft.draft_title || draft.source_title || 'Untitled';
  const baseSlug = generateSlug(title);

  let slug = baseSlug, attempt = 2;
  while (true) {
    const { data: existing } = await supabase.from(table).select('id').eq('slug', slug).maybeSingle();
    if (!existing) break;
    slug = `${baseSlug.slice(0, 57)}-${attempt++}`;
  }

  const heroImage = await resolveHeroImage(
    draft.source_url, draft.draft_title, draft.source_title, draft.draft_body, table, supabase,
  );

  const rawBody   = draft.draft_body
    .replace(/<!--\s*INDIA_PARAGRAPH\s*-->\n?/g, '')
    .replace(/<!--\s*\/INDIAN?_PARAGRAPH\s*-->\n?/g, '');  // /INDIAN_PARAGRAPH is a known model typo
  const cleanBody = prePublishAutoFix(rawBody, draft, slug);

  const cqsErr = cqsHardCheck(cleanBody);
  if (cqsErr) throw new Error(`[CQS REJECT] ${cqsErr}`);

  // Gate 10 (GEO-05b): auto-link the first mention of each distinct set
  // number to its /sets/[slug] page. Never blocks publish -- a mention
  // with no matching sets row is silently skipped (logged, not thrown).
  // Runs on cleanBody, not the excerpt -- excerptRaw below is derived from
  // cleanBody (pre-link) on purpose, so the meta description never shows
  // raw markdown link syntax.
  const { content: linkedBody, skipped: unresolvedSetMentions } = await linkFirstSetMentions(cleanBody, supabase);
  if (unresolvedSetMentions.length > 0) {
    console.log(`[Gate 10] ${unresolvedSetMentions.length} set mention(s) with no matching sets row, skipped: ${unresolvedSetMentions.join(', ')}`);
  }

  // Word-boundary truncation — the old hard .slice(0, 160) cut mid-word
  // ("…vehicle can p") in live meta descriptions (2026-07-02 audit).
  const excerptRaw = cleanBody.replace(/#{1,6}\s/g, '').replace(/\*+([^*]+)\*+/g, '$1').replace(/\s+/g, ' ').trim();
  const excerpt = excerptRaw.length <= 160
    ? excerptRaw
    : `${excerptRaw.slice(0, 156).replace(/\s+\S*$/, '')}…`;
  const now     = new Date().toISOString();

  // Review-format articles carry verdict + a matched set reference for
  // Review/Product JSON-LD (buildReviewSchema()) and, as of 2026-07-05, for
  // the dedicated `reviews` table itself (set_id, a uuid FK — distinct from
  // the set_number text column news_articles carries for the same purpose).
  let reviewVerdict: string | null = null, reviewSetNumber: string | null = null, reviewSetId: string | null = null;
  if (format === 'review') {
    reviewVerdict = (draft.draft_verdict || '').trim().toUpperCase() || null;
    const candidates = extractSetNumberCandidates(cleanBody);
    if (candidates.length > 0) {
      const { data: matchedSet } = await supabase.from('sets').select('id, set_number').in('set_number', candidates).limit(1).maybeSingle();
      const matched = matchedSet as { id?: string; set_number?: string } | null;
      reviewSetNumber = matched?.set_number ?? null;
      reviewSetId     = matched?.id ?? null;
    }
  }

  // `reviews` has a distinct schema from news_articles/blog_posts/guides — no
  // `category` column, but `verdict` (NOT NULL), `rating`, and `set_id` (uuid,
  // not the text `set_number` the other tables use) that they don't have.
  const row = table === 'reviews'
    ? {
        title, slug, content: linkedBody, excerpt,
        published_at: now, seo_title: title, seo_description: excerpt,
        hero_image: heroImage,
        verdict: reviewVerdict,
        rating: draft.draft_rating ?? (reviewVerdict ? VERDICT_TO_RATING[reviewVerdict] ?? null : null),
        ...(reviewSetId ? { set_id: reviewSetId } : {}),
      }
    : {
        title, slug, content: linkedBody, category, excerpt,
        published_at: now, seo_title: title, seo_description: excerpt,
        hero_image: heroImage,
        ...(reviewVerdict ? { verdict: reviewVerdict } : {}),
        ...(reviewSetNumber ? { set_number: reviewSetNumber } : {}),
      };

  const { error: insertErr } = await supabase.from(table).insert(row);
  if (insertErr) {
    throw new Error(`Insert failed (${table}): ${insertErr.message}`);
  }

  // Recrawl acceleration (replaces the dead Google sitemap ping): submit
  // this one new/updated article URL immediately. Never blocks publish --
  // submitToIndexNow() itself never throws, and any unexpected error here
  // is caught by publishOneDraft's own caller-level error handling like
  // any other post-insert step.
  await submitToIndexNow([`https://bricksofindia.com${path}/${slug}`]);

  const { error: markErr } = await supabase.from('pending_drafts').update({
    status: 'published', published_url: `${path}/${slug}`, published_at: now, lint_result: lint,
  }).eq('id', draft.id);
  if (markErr) {
    // Article already inserted — don't throw, but the draft row will be stale.
    console.error('[supabase-write] table=pending_drafts op=update(publishOneDraft) error:', markErr);
  }

  if (options.onPublished) options.onPublished(path);

  return { path, slug, table, reviewVerdict, reviewSetNumber };
}
