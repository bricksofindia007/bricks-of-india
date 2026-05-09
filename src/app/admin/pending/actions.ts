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
      maxAge: 60 * 60 * 8, // 8 hours
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
  const id = formData.get('id') as string;
  const supabase = createServerClient();
  await supabase
    .from('pending_drafts')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: 'admin' })
    .eq('id', id);
  revalidatePath('/admin/pending');
}

export async function rejectDraft(formData: FormData) {
  const id = formData.get('id') as string;
  const supabase = createServerClient();
  await supabase
    .from('pending_drafts')
    .update({ status: 'rejected' })
    .eq('id', id);
  revalidatePath('/admin/pending');
}
