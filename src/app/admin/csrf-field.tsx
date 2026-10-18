import { cookies } from 'next/headers';
import { ADMIN_COOKIE } from '@/lib/admin-session';
import { adminFormToken } from '@/lib/admin-form';

// Hidden field for one admin action. Rendered inside the form that posts to that action.
export async function CsrfField({ action }: { action: string }) {
  const value = adminFormToken((await cookies()).get(ADMIN_COOKIE)?.value, action);
  return <input type="hidden" name="csrf" value={value} />;
}
