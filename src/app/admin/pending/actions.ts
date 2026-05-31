'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase';
import { generateBody, extractSetNumber } from '@/lib/generate-body';

export async function login(formData: FormData) {
  const pw = (formData.get('password') as string) ?? '';
  const correct = process.env.ADMIN_PASSWORD;
  if (!correct) throw new Error('ADMIN_PASSWORD env var not set');
  if (pw === correct) {
    cookies().set('boi_admin', pw, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 8,
      path: '/admin',
      sameSite: 'strict',
    });
  }
  redirect('/admin/pending');
}

export async function logout() {
  cookies().delete('boi_admin');
  redirect('/admin/pending');
}

export async function approveDraft(formData: FormData) {
  const id         = formData.get('id') as string;
  const redirectTo = (formData.get('redirectTo') as string) || '/admin/pending';
  const supabase   = createServerClient();
  await supabase
    .from('pending_drafts')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: 'admin' })
    .eq('id', id);
  redirect(redirectTo);
}

export async function rejectDraft(formData: FormData) {
  const id         = formData.get('id') as string;
  const redirectTo = (formData.get('redirectTo') as string) || '/admin/pending';
  const supabase   = createServerClient();
  await supabase
    .from('pending_drafts')
    .update({ status: 'rejected' })
    .eq('id', id);
  redirect(redirectTo);
}

export async function approveAll(formData: FormData) {
  const format     = (formData.get('format') as string) || null;
  const domain     = (formData.get('domain') as string) || null;
  const redirectTo = (formData.get('redirectTo') as string) || '/admin/pending';
  const supabase   = createServerClient();

  let q = supabase
    .from('pending_drafts')
    .select('id')
    .eq('status', 'draft')
    .is('iteration_label', null);

  if (format) q = q.eq('draft_format', format);
  if (domain) q = q.ilike('source_url', `%${domain}%`);

  const { data } = await q;
  const ids = (data ?? []).map((r: any) => r.id);

  for (let i = 0; i < ids.length; i += 100) {
    await supabase
      .from('pending_drafts')
      .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: 'admin' })
      .in('id', ids.slice(i, i + 100));
  }

  redirect(redirectTo);
}

// ── Generate Article (on-demand, single draft) ────────────────────────────────

export async function generateArticle(formData: FormData) {
  const id         = formData.get('id') as string;
  const redirectTo = (formData.get('redirectTo') as string) || '/admin/pending?status=approved';
  try {
    const supabase = createServerClient();

    const { data: draft, error } = await supabase
      .from('pending_drafts')
      .select('id, source_url, source_title, source_excerpt, source_published_at, draft_format')
      .eq('id', id)
      .single();

    if (error || !draft) throw new Error(`Draft not found: ${error?.message}`);

    const { title, body, verdict, format, wordCount } = await generateBody(supabase, draft);

    await supabase
      .from('pending_drafts')
      .update({ draft_title: title, draft_body: body, draft_verdict: verdict, draft_format: format, word_count: wordCount, status: 'draft' })
      .eq('id', id);

    revalidatePath('/admin/pending');
    redirect(redirectTo);
  } catch (err: any) {
    if (err?.digest?.startsWith('NEXT_REDIRECT')) throw err;
    console.error('GEN FATAL:', err);
    const msg = err instanceof Error ? err.message : String(err);
    const sep = redirectTo.includes('?') ? '&' : '?';
    redirect(`${redirectTo}${sep}genError=${encodeURIComponent(msg)}&genDraftId=${encodeURIComponent(id)}`);
  }
}

// ── Trigger batch generation via GitHub Actions ───────────────────────────────

export async function triggerBatchGeneration(): Promise<{ ok: boolean; error?: string }> {
  const pw = cookies().get('boi_admin')?.value;
  if (!pw || pw !== process.env.ADMIN_PASSWORD) return { ok: false, error: 'Unauthorized' };
  const token = process.env.GH_DISPATCH_TOKEN;
  if (!token) return { ok: false, error: 'GH_DISPATCH_TOKEN not set — add to Netlify environment variables' };
  try {
    const res = await fetch(
      'https://api.github.com/repos/bricksofindia007/bricks-of-india/actions/workflows/generate-drafts.yml/dispatches',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: 'main' }),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (res.status === 204) return { ok: true };
    const body = await res.text();
    return { ok: false, error: `GitHub API error ${res.status}: ${body.slice(0, 200)}` };
  } catch (err: any) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

// ── Publish helpers ───────────────────────────────────────────────────────────

const UA = 'BricksOfIndia-RadarBot/1.0 (+https://bricksofindia.com)';

function generateSlug(title: string): string {
  return (title || 'untitled')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

function resolveTarget(format: string): { table: string; path: string; category: string } {
  if (format === 'guide')   return { table: 'guides',        path: '/guides', category: 'Guide'   };
  if (format === 'opinion') return { table: 'blog_posts',    path: '/blog',   category: 'Opinion' };
  if (format === 'review')  return { table: 'news_articles', path: '/news',   category: 'Review'  };
  return                           { table: 'news_articles', path: '/news',   category: 'News'    };
}

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const { load } = await import('cheerio');
    const $ = load(html);
    const og = $('meta[property="og:image"]').attr('content') ||
               $('meta[property="twitter:image"]').attr('content');
    return (og && og.startsWith('http')) ? og : null;
  } catch { return null; }
}

// ── WEB-01 lint gates ────────────────────────────────────────────────────────

const WORD_COUNT_TARGETS: Record<string, { pass: [number, number]; fail: [number, number] }> = {
  news    : { pass: [270,  440],  fail: [225,  500]  },  // target 300–400
  review  : { pass: [450,  770],  fail: [375,  875]  },  // target 500–700
  opinion : { pass: [360,  550],  fail: [300,  625]  },  // target 400–500
  guide   : { pass: [630, 1100],  fail: [525, 1250]  },  // target 700–1000
};
const VALID_VERDICTS = new Set(['BUY NOW', 'WAIT', 'IMPORT ONLY', 'AVOID']);

const INDIA_COMPARISON_RE = /\b(biryani|chai|EMI|Spotify|Netflix|petrol|samosa|litre|liter|movie.?ticket|PVR|butter.?chicken|Swiggy|Zomato|iPhone|months? of|weeks? of|auto.?rickshaw)\b/i;
const INDIA_STORE_RE      = /\b(Toycra|MyBrickHouse|Amazon|Flipkart|import.?only)\b/i;

function lintDraft(draft: {
  draft_body: string | null;
  draft_verdict: string | null;
  draft_format: string | null;
  word_count: number | null;
}): { warnings: string[] } {
  const body      = draft.draft_body || '';
  const format    = draft.draft_format || 'news';
  const wordCount = draft.word_count ?? body.split(/\s+/).filter(Boolean).length;
  const warnings: string[] = [];

  const targets        = WORD_COUNT_TARGETS[format] ?? WORD_COUNT_TARGETS.news;
  const [pMin, pMax]   = targets.pass;
  const [fMin, fMax]   = targets.fail;
  if (wordCount < fMin || wordCount > fMax) {
    throw new Error(
      `[Gate 1 FAIL] Word count ${wordCount} exceeds hard limit ${fMin}–${fMax} for '${format}'. Regenerate or heavily edit.`
    );
  }
  if (wordCount < pMin || wordCount > pMax) {
    warnings.push(`[Gate 1 WARN] Word count ${wordCount} outside target ${pMin}–${pMax} for '${format}'.`);
  }

  const markerIdx = body.indexOf('<!-- INDIA_PARAGRAPH -->');
  if (markerIdx === -1) {
    throw new Error('[Gate 2 FAIL] <!-- INDIA_PARAGRAPH --> marker missing. Regenerate the article.');
  }
  const indiaSeg = body.slice(markerIdx);
  if (!/₹[\d,]+/.test(indiaSeg)) {
    throw new Error('[Gate 2 FAIL] No INR price (₹NNN) found in India Paragraph. Regenerate or edit.');
  }
  if (!INDIA_STORE_RE.test(indiaSeg)) {
    throw new Error('[Gate 2 FAIL] No availability statement (Toycra / MyBrickHouse / Amazon / Flipkart / "import only") found in India Paragraph.');
  }
  if (!INDIA_COMPARISON_RE.test(indiaSeg)) {
    throw new Error('[Gate 2 FAIL] No relatable Indian comparison found in India Paragraph (expected: biryani, EMI, Spotify months, petrol, etc.).');
  }

  // Gate 3: verdict — required for review and opinion only; news skips this gate
  if (format !== 'news') {
    const v = (draft.draft_verdict || '').trim().toUpperCase();
    if (!VALID_VERDICTS.has(v)) {
      throw new Error(
        `[Gate 3 FAIL] Verdict '${draft.draft_verdict || 'none'}' is not in [BUY NOW, WAIT, IMPORT ONLY, AVOID]. Set a valid verdict before publishing.`
      );
    }
  }

  return { warnings };
}

async function sendLintAlert(draftTitle: string, gateMessage: string): Promise<void> {
  try {
    const { Resend } = await import('resend');
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from:    'Bricks of India <abhinav@bricksofindia.com>',
      to:      'abhinav@bricksofindia.com',
      subject: `[BOI Lint FAIL] ${draftTitle.slice(0, 60)}`,
      text: [
        'A draft failed lint gates and was NOT published.',
        '',
        `Draft:  ${draftTitle}`,
        `Error:  ${gateMessage}`,
        '',
        'Fix the draft in /admin/pending and try publishing again.',
        'https://bricksofindia.com/admin/pending',
      ].join('\n'),
    });
  } catch (mailErr: any) {
    console.error('[sendLintAlert] email failed:', mailErr?.message);
  }
}

// ── YouTube hero image fallback chain ────────────────────────────────────────

const YOUTUBE_SRC_RE = /youtube\.com|youtu\.be/i;
const YOUTUBE_IMG_RE = /ytimg\.com|yt3\.ggpht\.com|youtube\.com\/vi\//i;

const LEGO_THEME_KEYWORDS = [
  'Technic','City','Star Wars','Harry Potter','Ideas','Icons','Creator','Ninjago',
  'Friends','Marvel','DC','Disney','Minecraft','Speed Champions','Architecture',
  'Botanical','BrickHeadz','Duplo','Monkie Kid','Jurassic World','Super Mario',
  'Dreamzzz','Classic','Seasonal','DOTS','Dimensions','Hidden Side',
];

async function resolveYouTubeHeroImage(
  title: string | null,
  body: string | null,
): Promise<string | null> {
  const rbKey  = process.env.REBRICKABLE_API_KEY;
  const rbHdrs = { 'User-Agent': UA, ...(rbKey ? { Authorization: `key ${rbKey}` } : {}) };
  const combined = `${title ?? ''} ${body ?? ''}`;

  // Steps 1+2: extract distinct 4–6 digit set numbers, try Rebrickable for each
  const seen = new Set<string>();
  const setNums: string[] = [];
  const re = /\b(\d{4,6})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(combined)) !== null) {
    if (!seen.has(m[1])) { seen.add(m[1]); setNums.push(m[1]); }
  }
  for (const num of setNums.slice(0, 5)) {
    try {
      const res = await fetch(
        `https://rebrickable.com/api/v3/lego/sets/${num}-1/`,
        { headers: rbHdrs, signal: AbortSignal.timeout(5000) },
      );
      if (res.ok) {
        const data = await res.json() as { set_img_url?: string };
        if (data.set_img_url) {
          console.log(`[publish:yt] set ${num} → ${data.set_img_url.slice(0, 70)}`);
          return data.set_img_url;
        }
      }
    } catch { /* try next set number */ }
  }

  // Step 3: theme keyword → Rebrickable search → first set with image
  const titleLower = (title ?? '').toLowerCase();
  const theme = LEGO_THEME_KEYWORDS.find(t => titleLower.includes(t.toLowerCase()));
  if (theme) {
    try {
      const res = await fetch(
        `https://rebrickable.com/api/v3/lego/sets/?search=${encodeURIComponent(theme)}&ordering=-year&page_size=5`,
        { headers: rbHdrs, signal: AbortSignal.timeout(5000) },
      );
      if (res.ok) {
        const data = await res.json() as { results?: Array<{ set_img_url?: string }> };
        const hit = (data.results ?? []).find(s => s.set_img_url);
        if (hit?.set_img_url) {
          console.log(`[publish:yt] theme "${theme}" → ${hit.set_img_url.slice(0, 70)}`);
          return hit.set_img_url;
        }
      }
    } catch { /* fall through */ }
  }

  // Step 4: all chains exhausted — publish without hero image
  console.log('[publish:yt] no image resolved — hero will be null');
  return null;
}

// ── publishOneDraft — shared core, called by publishDraft and publishAll ──────

type PublishableDraft = {
  id: string;
  draft_title: string | null;
  draft_body: string | null;
  draft_verdict: string | null;
  draft_format: string | null;
  word_count: number | null;
  source_url: string;
  source_title: string | null;
};

async function publishOneDraft(
  draft: PublishableDraft,
  supabase: ReturnType<typeof createServerClient>,
  sendAlerts: boolean,
): Promise<{ path: string; slug: string }> {
  if (!draft.draft_body) throw new Error('Draft has no generated body');

  let lintWarnings: string[] = [];
  try {
    ({ warnings: lintWarnings } = lintDraft(draft));
  } catch (lintErr: any) {
    if (sendAlerts) await sendLintAlert(draft.draft_title || draft.source_title || 'Untitled', lintErr.message);
    throw lintErr;
  }
  if (lintWarnings.length > 0) console.warn('[publish lint]', lintWarnings.join(' | '));

  const format             = draft.draft_format || 'news';
  const { table, path, category } = resolveTarget(format);
  const title              = draft.draft_title || draft.source_title || 'Untitled';
  const baseSlug           = generateSlug(title);

  let slug = baseSlug, attempt = 2;
  while (true) {
    const { data: existing } = await supabase.from(table).select('id').eq('slug', slug).maybeSingle();
    if (!existing) break;
    slug = `${baseSlug.slice(0, 57)}-${attempt++}`;
  }

  let heroImage = await fetchOgImage(draft.source_url);
  console.log(`[publish] og=${!!heroImage} url=${draft.source_url.slice(0, 60)}`);

  // YouTube sources: bypass thumbnail CDN, resolve proper set image via Rebrickable chain
  if (YOUTUBE_SRC_RE.test(draft.source_url) || (heroImage !== null && YOUTUBE_IMG_RE.test(heroImage))) {
    console.log('[publish] YouTube source detected — running Rebrickable fallback chain');
    heroImage = await resolveYouTubeHeroImage(draft.draft_title, draft.draft_body);
  }

  if (heroImage) {
    try {
      const imgRes = await fetch(heroImage, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      if (!imgRes.ok) {
        const gate4Err = new Error(`[Gate 4 FAIL] Hero image URL returned HTTP ${imgRes.status}`);
        if (sendAlerts) await sendLintAlert(draft.draft_title || draft.source_title || 'Untitled', gate4Err.message);
        throw gate4Err;
      }
    } catch (err: any) {
      if (err.message?.startsWith('[Gate 4 FAIL]')) throw err;
      console.warn(`[Gate 4 WARN] hero image check failed (${err.message}) — proceeding`);
    }
  }

  if (heroImage) {
    const { data: imgConflict } = await supabase.from(table).select('id').eq('hero_image', heroImage).maybeSingle();
    if (imgConflict) {
      heroImage = null;
      const setNum = extractSetNumber(draft.source_url, draft.source_title ?? null);
      if (setNum) {
        const { data: setRow } = await supabase.from('sets').select('image_url').eq('set_number', setNum).maybeSingle();
        const candidate = setRow?.image_url ?? null;
        if (candidate) {
          const { data: fallbackConflict } = await supabase.from(table).select('id').eq('hero_image', candidate).maybeSingle();
          if (!fallbackConflict) {
            try {
              const fbRes = await fetch(candidate, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
              if (fbRes.ok) heroImage = candidate;
            } catch { /* drop to null */ }
          }
        }
      }
    }
  }

  const cleanBody = draft.draft_body.replace(/<!--\s*INDIA_PARAGRAPH\s*-->\n?/g, '');
  const excerpt   = cleanBody.replace(/#{1,6}\s/g, '').replace(/\*+([^*]+)\*+/g, '$1').replace(/\s+/g, ' ').trim().slice(0, 160);
  const now       = new Date().toISOString();

  const { error: insertErr } = await supabase.from(table).insert({
    title, slug, content: cleanBody, category, excerpt,
    published_at: now, seo_title: title, seo_description: excerpt,
    ...(heroImage ? { hero_image: heroImage } : {}),
  });
  if (insertErr) throw new Error(`Insert failed (${table}): ${insertErr.message}`);

  await supabase.from('pending_drafts').update({ status: 'published', published_url: `${path}/${slug}` }).eq('id', draft.id);
  revalidatePath(path);

  return { path, slug };
}

// ── publishDraft — single draft via Publish button ────────────────────────────

export async function publishDraft(formData: FormData) {
  const id         = formData.get('id') as string;
  const redirectTo = (formData.get('redirectTo') as string) || '/admin/pending?status=approved';
  const supabase   = createServerClient();

  const { data: draft, error: fetchErr } = await supabase
    .from('pending_drafts')
    .select('id, draft_title, draft_body, draft_verdict, draft_format, word_count, source_url, source_title')
    .eq('id', id)
    .single();

  if (fetchErr || !draft) throw new Error(`Draft not found: ${fetchErr?.message}`);

  await publishOneDraft(draft, supabase, true);
  redirect(redirectTo);
}

