'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase';
import fs from 'fs';
import path from 'path';

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

const SKIP_FETCH_DOMAINS = new Set(['rebrickable.com', 'youtube.com', 'reddit.com', 'i.redd.it']);
const UA = 'BricksOfIndia-RadarBot/1.0 (+https://bricksofindia.com)';

async function fetchFullBody(url: string): Promise<string | null> {
  let hostname: string;
  try { hostname = new URL(url).hostname.replace(/^www\./, ''); }
  catch { return null; }
  if (SKIP_FETCH_DOMAINS.has(hostname)) return null;

  try {
    // Dynamic import — cheerio is a devDep, import only at runtime
    const { load } = await import('cheerio');
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, 'Accept': 'text/html' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const $ = load(html);

    $('nav, header, footer, aside, script, style, iframe, figure').remove();
    $('.sidebar, .widget-area, .widget, #sidebar, .advertisement, .ads').remove();
    $('[class*="share-"], [class*="-share"], [class*="social-"], [class*="related-"], ' +
      '[class*="comment-"], [class*="-comments"], .commentlist, .sharedaddy').remove();

    const SELECTORS = ['article', '.post-content', '.entry-content', '.article-body', '.layout-grid-content'];
    for (const sel of SELECTORS) {
      const text = $(sel).first().text().replace(/\s+/g, ' ').trim();
      if (text.length >= 300) return text.slice(0, 4000);
    }
    // Paragraph fallback
    const parts: string[] = [];
    $('main p').each((_, el) => { const t = $(el).text().trim(); if (t) parts.push(t); });
    const joined = parts.join(' ');
    if (joined.length >= 300) return joined.slice(0, 4000);
    return null;
  } catch { return null; }
}

const FORMAT_ADDENDUM: Record<string, string> = {
  news: `
---
FORMAT RULES — NEWS ARTICLE:
- Length: 300–400 words in BODY. Title MUST include set number (if available) + "India".
- Opening: Start on something Indian (wallet pain, chai, EMI, traffic). Pivot to LEGO in 1–2 sentences.
- No host introduction. No "Hello Brickfans."
- Sign-off: "On that bombshell..." variants only. Never "Bubyee."
- VERDICT IN BODY: BUY / WAIT FOR SALE / IMPORT ONLY / SKIP — as explicit statement before sign-off.`,
  review: `
---
FORMAT RULES — SET REVIEW:
- Length: 500–700 words in BODY. Title formula: "Worth ₹[INR price] in India?"
- Opening: Indian hook, pivot to LEGO. No host intro.
- Sign-off: "On that bombshell..." only.
- VERDICT IN BODY: explicit statement before sign-off.`,
  opinion: `
---
FORMAT RULES — OPINION PIECE:
- Length: 400–500 words in BODY. Title MUST reference India/wallet/price context.
- Opening: Indian hook, pivot to LEGO. No host intro.
- Sign-off: "On that bombshell..." only.
- VERDICT IN BODY: explicit statement before sign-off.`,
};

const INDIA_PARAGRAPH_SPEC = `
---
INDIA PARAGRAPH — MANDATORY (single consolidated block):
Write it as a normal paragraph — NO HTML comments, NO placeholder markers.
Must contain:
(a) INR price: USD MSRP × 1.35 × current USD/INR rate. Show working.
(b) Availability: which stores (Toycra, MyBrickHouse, Jaiman) or "import only".
(c) India lag: 4–6 week delay or "no official India launch".
(d) One relatable Indian comparison (biryani plates, Spotify months, EMI, etc.).`;

const ANTI_PATTERNS = `
---
ANTI-PATTERNS — DO NOT USE:
• "Hello Brickfans" / host introduction of any kind
• "Bubyee" / YouTube sign-offs — website ends "On that bombshell..." only
• Source site's framing ("today's random set", "today we're talking about")
• Asserting ungrounded facts (piece counts, themes, dates not in SOURCE)
• "my friends" / "folks" — Clarkson register is aloof, not folksy
• Do not announce what you are about to do. Just do it.`;

export async function generateArticle(formData: FormData) {
  const id         = formData.get('id') as string;
  const redirectTo = (formData.get('redirectTo') as string) || '/admin/pending?status=approved';
  const supabase   = createServerClient();

  // Fetch the draft
  const { data: draft, error } = await supabase
    .from('pending_drafts')
    .select('id, source_url, source_title, source_excerpt, source_published_at, draft_format')
    .eq('id', id)
    .single();

  if (error || !draft) throw new Error(`Draft not found: ${error?.message}`);
  if (draft.draft_format === null) throw new Error('Draft has no format — re-run RADAR-03');

  const format    = (draft.draft_format as string) || 'news';
  const setNumber = (() => { const m = (draft.source_url || '').match(/\/sets\/(\d{4,5})-/); return m ? m[1] : null; })();

  // Full-text fetch
  const fullBody = await fetchFullBody(draft.source_url);
  const content  = fullBody || draft.source_excerpt || draft.source_title || '(no content available)';
  const wordTarget = { news: '300–400', review: '500–700', opinion: '400–500' }[format] || '300–400';
  const setLine    = setNumber
    ? `Set number: ${setNumber} (include in title per format rules)`
    : `Set number: NOT FOUND — use India context in title instead`;

  // Build prompts
  const codexPath   = path.join(process.cwd(), 'docs/codex/BOI_Codex_v2.md');
  const codex       = fs.existsSync(codexPath) ? fs.readFileSync(codexPath, 'utf8') : '';
  const systemPrompt = codex + (FORMAT_ADDENDUM[format] || FORMAT_ADDENDUM.news) + INDIA_PARAGRAPH_SPEC + ANTI_PATTERNS;

  const userPrompt = `Write a BOI-voice ${format} article. Target: ${wordTarget} words in body.

SOURCE:
Title     : ${draft.source_title}
URL       : ${draft.source_url}
Published : ${draft.source_published_at || 'unknown'}
${setLine}
${fullBody ? 'Full article body' : 'Excerpt'}: ${content}

--- BOI_DRAFT_START ---
FORMAT: ${format}
TITLE: <your title>
VERDICT: <BUY | WAIT FOR SALE | IMPORT ONLY | SKIP | NONE>

BODY:
<article body — place <!-- INDIA_PARAGRAPH --> before the India Paragraph block>
--- BOI_DRAFT_END ---`;

  // Gemini call
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genai  = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const result = await genai
    .getGenerativeModel({ model: 'gemini-2.5-flash-lite', systemInstruction: systemPrompt })
    .generateContent({
      contents         : [{ role: 'user', parts: [{ text: userPrompt }] }],
      generationConfig : { temperature: 0.7, maxOutputTokens: 2000 },
    });

  const rawText = result.response.text();
  if (!rawText?.trim()) throw new Error('Gemini returned empty response');

  // Parse structured response
  const si = rawText.indexOf('--- BOI_DRAFT_START ---');
  const ei = rawText.indexOf('--- BOI_DRAFT_END ---');
  if (si === -1 || ei === -1) throw new Error('Gemini response missing BOI_DRAFT markers');

  const inner = rawText.slice(si + '--- BOI_DRAFT_START ---'.length, ei).trim();
  let title = '', verdict: string | null = null, inBody = false;
  const bodyLines: string[] = [];

  for (const line of inner.split('\n')) {
    if (!inBody) {
      if (line.startsWith('TITLE:'))   title   = line.slice(6).trim();
      if (line.startsWith('VERDICT:')) {
        const v = line.slice(8).trim();
        verdict = ['BUY','WAIT FOR SALE','IMPORT ONLY','SKIP'].includes(v) ? v : null;
      }
      if (line.trim() === 'BODY:') inBody = true;
    } else { bodyLines.push(line); }
  }

  let body = bodyLines.join('\n').trim();
  if (!title || !body) throw new Error('Gemini response missing TITLE or BODY');

  // Verdict backstop
  const TEMPLATES: Record<string, string> = {
    'BUY':           'Verdict: BUY. The price is right — grab it.',
    'WAIT FOR SALE': 'Verdict: WAIT FOR SALE. Decent set, but wait for a discount.',
    'IMPORT ONLY':   'Verdict: IMPORT ONLY. Worth it if you can handle the customs markup.',
    'SKIP':          'Verdict: SKIP. Save your money for something better.',
  };
  if (verdict && !['buy','wait for sale','import only','skip'].some(v => body.toLowerCase().includes(v))) {
    body += '\n\n' + TEMPLATES[verdict];
  }

  const wordCount = body.split(/\s+/).filter(Boolean).length;

  await supabase
    .from('pending_drafts')
    .update({ draft_title: title, draft_body: body, draft_verdict: verdict, draft_format: format, word_count: wordCount, status: 'draft' })
    .eq('id', id);

  revalidatePath('/admin/pending');
  redirect(redirectTo);
}

// ── Publish helpers ───────────────────────────────────────────────────────────

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
  if (format === 'opinion') return { table: 'blog_posts',    path: '/blog', category: 'Opinion' };
  if (format === 'review')  return { table: 'news_articles', path: '/news', category: 'Review'  };
  return                           { table: 'news_articles', path: '/news', category: 'News'    };
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

export async function publishDraft(formData: FormData) {
  const id         = formData.get('id') as string;
  const redirectTo = (formData.get('redirectTo') as string) || '/admin/pending?status=approved';
  const supabase   = createServerClient();

  const { data: draft, error: fetchErr } = await supabase
    .from('pending_drafts')
    .select('id, draft_title, draft_body, draft_verdict, draft_format, source_url, source_title')
    .eq('id', id)
    .single();

  if (fetchErr || !draft) throw new Error(`Draft not found: ${fetchErr?.message}`);
  if (!draft.draft_body)  throw new Error('Draft has no generated body — click Generate Article first');

  const format   = draft.draft_format || 'news';
  const { table, path, category } = resolveTarget(format);
  const title    = draft.draft_title || draft.source_title || 'Untitled';
  const baseSlug = generateSlug(title);

  let slug = baseSlug, attempt = 2;
  while (true) {
    const { data: existing } = await supabase.from(table).select('id').eq('slug', slug).maybeSingle();
    if (!existing) break;
    slug = `${baseSlug.slice(0, 57)}-${attempt++}`;
  }

  // Fetch OG image from source — 5s timeout, fall back to null gracefully
  const heroImage = await fetchOgImage(draft.source_url);
  console.log(`[publish] source_url=${draft.source_url} og_image_found=${!!heroImage} image_url=${heroImage?.slice(0, 80) ?? 'none'}`);

  // Strip HTML comment marker — belt-and-suspenders for any draft that still has it
  const cleanBody = draft.draft_body.replace(/<!--\s*INDIA_PARAGRAPH\s*-->\n?/g, '');

  const excerpt = cleanBody.replace(/#{1,6}\s/g, '').replace(/\*+([^*]+)\*+/g, '$1').replace(/\s+/g, ' ').trim().slice(0, 160);
  const now = new Date().toISOString();

  const { error: insertErr } = await supabase.from(table).insert({
    title, slug, content: cleanBody, category, excerpt,
    published_at: now, seo_title: title, seo_description: excerpt,
    ...(heroImage ? { hero_image: heroImage } : {}),
  });
  if (insertErr) throw new Error(`Publish failed (${table}): ${insertErr.message}`);

  await supabase.from('pending_drafts').update({ status: 'published', published_url: `${path}/${slug}` }).eq('id', id);

  revalidatePath(path);
  redirect(redirectTo);
}
