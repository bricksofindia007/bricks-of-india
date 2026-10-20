import { cookies } from 'next/headers';
import { ADMIN_COOKIE, isValidAdminSession } from '@/lib/admin-session';
import { adminFormTokenValid } from '@/lib/admin-form';

// Z3 (1 Oct 2026): every admin Server Action is a public POST endpoint. Each one must check
// the admin session itself; rendering the form only after login is not protection.
export async function requireAdmin(): Promise<void> {
  if (!(await isValidAdminSession((await cookies()).get(ADMIN_COOKIE)?.value))) throw new Error('Unauthorized');
}

// B6b: a state-changing action also needs the signed field its own form rendered for this session.
export async function requireAdminForm(formData: FormData, action: string): Promise<void> {
  const session = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!(await isValidAdminSession(session))) throw new Error('Unauthorized');
  if (!adminFormTokenValid(formData.get('csrf'), session, action)) throw new Error('Unauthorized');
}
