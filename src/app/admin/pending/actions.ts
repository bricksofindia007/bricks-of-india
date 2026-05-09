'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/lib/supabase';

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

// Maps draft_format to target table and category.
// NOTE: draft_format='review' cannot go to the reviews table — that table
// requires set_id (FK) and rating (int), neither of which RADAR-04 produces.
// Review-format drafts are published to news_articles with category='Review'.
function resolveTarget(format: string): { table: string; path: string; category: string } {
  if (format === 'opinion') return { table: 'blog_posts',    path: '/blog',    category: 'Opinion' };
  if (format === 'review')  return { table: 'news_articles', path: '/news',    category: 'Review'  };
  return                           { table: 'news_articles', path: '/news',    category: 'News'    };
}

export async function publishDraft(formData: FormData) {
  const id         = formData.get('id') as string;
  const redirectTo = (formData.get('redirectTo') as string) || '/admin/pending?status=approved';
  const supabase   = createServerClient();

  // Fetch the draft
  const { data: draft, error: fetchErr } = await supabase
    .from('pending_drafts')
    .select('id, draft_title, draft_body, draft_verdict, draft_format, source_url, source_title')
    .eq('id', id)
    .single();

  if (fetchErr || !draft) throw new Error(`Draft not found: ${fetchErr?.message}`);
  if (!draft.draft_body)  throw new Error('Draft has no generated body — run RADAR-04 first');

  const format  = draft.draft_format || 'news';
  const { table, path, category } = resolveTarget(format);
  const title   = draft.draft_title || draft.source_title || 'Untitled';
  const baseSlug = generateSlug(title);

  // Ensure slug uniqueness — append -2, -3 etc. if already taken
  let slug = baseSlug;
  let attempt = 2;
  while (true) {
    const { data: existing } = await supabase.from(table).select('id').eq('slug', slug).maybeSingle();
    if (!existing) break;
    slug = `${baseSlug.slice(0, 57)}-${attempt++}`;
  }

  // Build excerpt: strip markdown-ish syntax, take first 160 chars
  const excerpt = (draft.draft_body)
    .replace(/#{1,6}\s/g, '')
    .replace(/\*+([^*]+)\*+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);

  const now = new Date().toISOString();

  const { error: insertErr } = await supabase.from(table).insert({
    title,
    slug,
    content      : draft.draft_body,
    category,
    excerpt,
    published_at : now,
    seo_title    : title,
    seo_description: excerpt,
  });

  if (insertErr) throw new Error(`Publish failed (${table}): ${insertErr.message}`);

  // Mark pending_draft as published
  await supabase
    .from('pending_drafts')
    .update({ status: 'published', published_url: `${path}/${slug}` })
    .eq('id', id);

  revalidatePath(path);
  redirect(redirectTo);
}
