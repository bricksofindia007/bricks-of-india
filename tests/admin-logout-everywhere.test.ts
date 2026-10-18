// "Log out everywhere" on the admin page: it requires a signed-in admin, ends every session, and a failed revoke
// shows an error, never a success.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const h = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revokeAll: vi.fn(),
  cookieDelete: vi.fn(),
}));

vi.mock('../src/app/admin/require-admin', () => ({ requireAdmin: h.requireAdmin }));
vi.mock('../src/lib/admin-session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/lib/admin-session')>()),
  revokeAllAdminSessions: h.revokeAll,
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ delete: h.cookieDelete, get: () => undefined, set: () => undefined }) }));
vi.mock('next/navigation', () => ({ redirect: (to: string) => { throw new Error(`NEXT_REDIRECT ${to}`); } }));
vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));
vi.mock('../src/lib/generate-body', () => ({ generateBody: async () => ({}) }));
vi.mock('../src/lib/publish-draft', () => ({ publishOneDraft: async () => ({}) }));
vi.mock('../src/lib/supabase', () => ({ createServerClient: () => ({}) }));

import { logoutEverywhere } from '../src/app/admin/pending/actions';

const root = join(__dirname, '..');

beforeEach(() => {
  h.requireAdmin.mockReset().mockResolvedValue(undefined);
  h.revokeAll.mockReset().mockResolvedValue(undefined);
  h.cookieDelete.mockReset();
});

describe('requires a signed-in admin', () => {
  it('a caller who is not signed in is refused, and nothing is revoked', async () => {
    h.requireAdmin.mockRejectedValue(new Error('Unauthorized'));
    await expect(logoutEverywhere(null)).rejects.toThrow('Unauthorized');
    expect(h.revokeAll).not.toHaveBeenCalled();
    expect(h.cookieDelete).not.toHaveBeenCalled();
  });
  it('the signed-in check runs before the revoke (the source order is the same)', () => {
    const src = readFileSync(join(root, 'src/app/admin/pending/actions.ts'), 'utf8');
    const body = src.slice(src.indexOf('export async function logoutEverywhere'));
    expect(body.indexOf('await requireAdmin()')).toBeGreaterThan(-1);
    expect(body.indexOf('await requireAdmin()')).toBeLessThan(body.indexOf('await revokeAllAdminSessions()'));
  });
});

describe('a signed-in admin', () => {
  it('ends every session, clears this browser cookie, and goes back to the admin page', async () => {
    await expect(logoutEverywhere(null)).rejects.toThrow('NEXT_REDIRECT /admin/pending');
    expect(h.revokeAll).toHaveBeenCalledTimes(1);
    expect(h.cookieDelete).toHaveBeenCalledWith('boi_admin');
  });
});

describe('a failed revoke shows an error, never a success', () => {
  it('returns an error and does not redirect or clear the cookie', async () => {
    h.revokeAll.mockRejectedValue(new Error('admin sessions could not be revoked'));
    const state = await logoutEverywhere(null);
    expect(state).toEqual({ error: 'Sessions could not be ended. Nothing has changed. Try again.' });
    expect(h.cookieDelete).not.toHaveBeenCalled();
  });
  it('the error text does not say the user was signed out', async () => {
    h.revokeAll.mockRejectedValue(new Error('down'));
    const state = await logoutEverywhere(null);
    expect(state?.error).not.toMatch(/signed out|logged out|ended everywhere/i);
  });
});

describe('the button on the admin page', () => {
  it('is a client control that runs the action and shows its error in an alert', () => {
    const src = readFileSync(join(root, 'src/app/admin/pending/LogoutEverywhereButton.tsx'), 'utf8');
    expect(src).toMatch(/^'use client';/m);
    expect(src).toContain('useActionState<LogoutEverywhereState, FormData>(logoutEverywhere, null)');
    expect(src).toMatch(/role="alert"[\s\S]*\{state\.error\}/);
    expect(src).toContain('Log out everywhere');
  });
  it('is on the admin page, which only renders for a signed-in admin', () => {
    const page = readFileSync(join(root, 'src/app/admin/pending/page.tsx'), 'utf8');
    expect(page).toContain('<LogoutEverywhereButton />');
    expect(page).toMatch(/if \(!\(await isAuthed\(\)\)\) return <LoginPage \/>;/);
  });
});
