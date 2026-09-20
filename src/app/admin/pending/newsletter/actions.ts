'use server';

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';

/**
 * Approve/dismiss act directly on growth.newsletter_drafts — the same
 * table and same status values the real send pipeline
 * (boi-growth-engine/newsletter/send.py) already reads. This is not a
 * shadow/parallel approval system: approving a draft here is exactly
 * equivalent to approving it via the growth-engine's own dashboard
 * (currently unreachable — see BOI_MASTER_TRACKER.md, issue #122 +
 * the separate Netlify usage_exceeded block on that app).
 */

export async function approveNewsletterDraft(formData: FormData) {
  const id = formData.get('id') as string;
  if (!id) return;
  const supabase = createServerClient();
  const { error } = await supabase
    .schema('growth')
    .from('newsletter_drafts')
    .update({ status: 'approved' })
    .eq('id', id)
    .eq('status', 'pending_approval');
  if (error) {
    console.error('[supabase-write] table=growth.newsletter_drafts op=update(approve) draft_id=', id, 'error:', error);
    throw error;
  }
  redirect('/admin/pending/newsletter');
}

export async function dismissNewsletterDraft(formData: FormData) {
  const id = formData.get('id') as string;
  if (!id) return;
  const supabase = createServerClient();
  const { error } = await supabase
    .schema('growth')
    .from('newsletter_drafts')
    .update({ status: 'dismissed' })
    .eq('id', id)
    .eq('status', 'pending_approval');
  if (error) {
    console.error('[supabase-write] table=growth.newsletter_drafts op=update(dismiss) draft_id=', id, 'error:', error);
    throw error;
  }
  redirect('/admin/pending/newsletter');
}
