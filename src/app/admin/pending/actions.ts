'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
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
  const id          = formData.get('id') as string;
  const redirectTo  = (formData.get('redirectTo') as string) || '/admin/pending';
  const supabase    = createServerClient();
  await supabase
    .from('pending_drafts')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: 'admin' })
    .eq('id', id);
  redirect(redirectTo);
}

export async function rejectDraft(formData: FormData) {
  const id          = formData.get('id') as string;
  const redirectTo  = (formData.get('redirectTo') as string) || '/admin/pending';
  const supabase    = createServerClient();
  await supabase
    .from('pending_drafts')
    .update({ status: 'rejected' })
    .eq('id', id);
  redirect(redirectTo);
}

export async function approveAll(formData: FormData) {
  const format      = (formData.get('format') as string) || null;
  const domain      = (formData.get('domain') as string) || null;
  const redirectTo  = (formData.get('redirectTo') as string) || '/admin/pending';

  const supabase = createServerClient();
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
