import { cookies } from 'next/headers';
import { ADMIN_COOKIE, isValidAdminSession } from '@/lib/admin-session';

// Z3 (1 Oct 2026): every admin Server Action is a public POST endpoint. Each one must check
// the admin session itself; rendering the form only after login is not protection.
export async function requireAdmin(): Promise<void> {
  if (!isValidAdminSession((await cookies()).get(ADMIN_COOKIE)?.value)) throw new Error('Unauthorized');
}
