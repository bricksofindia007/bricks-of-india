import { cookies } from 'next/headers';
import { timingSafeEqual } from 'node:crypto';

// Z3 (1 Oct 2026): every admin Server Action is a public POST endpoint. Each one must check
// the admin cookie itself; rendering the form only after login is not protection.
export async function requireAdmin(): Promise<void> {
  const pw = (await cookies()).get('boi_admin')?.value ?? '';
  const correct = process.env.ADMIN_PASSWORD ?? '';
  const a = Buffer.from(pw), b = Buffer.from(correct);
  if (!correct || a.length !== b.length || !timingSafeEqual(a, b)) throw new Error('Unauthorized');
}
