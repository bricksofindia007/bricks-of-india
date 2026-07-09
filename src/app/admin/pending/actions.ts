'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase';
import { generateBody } from '@/lib/generate-body';
import { publishOneDraft } from '@/lib/publish-draft';

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
  const { error: approveErr } = await supabase
    .from('pending_drafts')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: 'admin' })
    .eq('id', id);
  if (approveErr) {
    console.error('[supabase-write] admin-action table=pending_drafts op=update(approve) draft_id=', id, 'error:', approveErr);
    throw approveErr;
  }
  redirect(redirectTo);
}

export async function rejectDraft(formData: FormData) {
  const id         = formData.get('id') as string;
  const redirectTo = (formData.get('redirectTo') as string) || '/admin/pending';
  const supabase   = createServerClient();
  const { error: rejectErr } = await supabase
    .from('pending_drafts')
    .update({ status: 'rejected' })
    .eq('id', id);
  if (rejectErr) {
    console.error('[supabase-write] admin-action table=pending_drafts op=update(reject) draft_id=', id, 'error:', rejectErr);
    throw rejectErr;
  }
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
    const batch = ids.slice(i, i + 100);
    const { error: batchErr } = await supabase
      .from('pending_drafts')
      .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: 'admin' })
      .in('id', batch);
    if (batchErr) {
      const batchPreview = batch.length > 3 ? `${batch.slice(0, 3).join(',')}...` : batch.join(',');
      console.error('[supabase-write] admin-action table=pending_drafts op=update(approveAll) batch_start=', i, 'batch_size=', batch.length, 'ids=', batchPreview, 'error:', batchErr);
      throw batchErr;
    }
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

    const { title, body, verdict, rating, format, wordCount } = await generateBody(supabase, draft);

    const { error: saveErr } = await supabase
      .from('pending_drafts')
      .update({ draft_title: title, draft_body: body, draft_verdict: verdict, draft_rating: rating, draft_format: format, word_count: wordCount, status: 'draft' })
      .eq('id', id);
    if (saveErr) {
      console.error('[supabase-write] admin-action table=pending_drafts op=update(generateArticle) draft_id=', id, 'error:', saveErr);
      throw saveErr;
    }

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
//
// Unified 2026-06-28 (MEDIUM-38 follow-up, full merge): generateSlug,
// resolveTarget, fetchOgImage, resolveYouTubeHeroImage, resolveHeroImage,
// prePublishAutoFix, cqsHardCheck, and the core publishOneDraft orchestration
// all now live in src/lib/publish-draft.ts, shared with scripts/publish-drafts.mjs
// (the cron) and scripts/generate-approved-drafts.ts (the news auto-publish
// path). This file's prior independent implementation had drifted from the
// cron's in real ways — missing review verdict/set_number columns, a less
// complete hero-image fallback chain's CDN-block detection, etc. See
// publish-draft.ts's header comment for the full list of what was merged
// and how the conflicts (opinion path, hero-image fallback policy) were
// resolved.

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

// ── publishDraft — single draft via Publish button ────────────────────────────

export async function publishDraft(formData: FormData) {
  const id         = formData.get('id') as string;
  const redirectTo = (formData.get('redirectTo') as string) || '/admin/pending?status=approved';
  const supabase   = createServerClient();

  const { data: draft, error: fetchErr } = await supabase
    .from('pending_drafts')
    .select('id, draft_title, draft_body, draft_verdict, draft_rating, draft_format, word_count, source_url, source_title, source_excerpt, lint_result, updated_at')
    .eq('id', id)
    .single();

  if (fetchErr || !draft) throw new Error(`Draft not found: ${fetchErr?.message}`);

  const { path } = await publishOneDraft(draft, supabase, {
    onLintFail:  sendLintAlert,
    onPublished: (publishedPath) => revalidatePath(publishedPath),
  });
  redirect(redirectTo);
}
