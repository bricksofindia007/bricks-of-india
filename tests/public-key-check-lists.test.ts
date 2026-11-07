// The public key check lists must agree with the migrations that remove anonymous table reads (order 0760).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const check = readFileSync(join(root, 'scripts/ci/public-key-check.mjs'), 'utf8');

function list(name: 'CLOSED' | 'OPEN'): string[] {
  const m = new RegExp(`export const ${name} = \\[([\\s\\S]*?)\\];`).exec(check);
  if (!m) throw new Error(`no ${name} list`);
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

describe('public key check lists', () => {
  const CLOSED = list('CLOSED');
  const OPEN = list('OPEN');

  it('store_prices and price_history are closed to the public key (anonymous reads removed on purpose)', () => {
    expect(CLOSED).toContain('store_prices');
    expect(CLOSED).toContain('price_history');
    expect(OPEN).not.toContain('store_prices');
    expect(OPEN).not.toContain('price_history');
  });

  it('no table is in both lists', () => {
    expect(OPEN.filter((t) => CLOSED.includes(t))).toEqual([]);
  });

  it('every table a migration revokes from anon is in CLOSED, never in OPEN', () => {
    const dir = join(root, 'supabase/migrations');
    const revoked = new Set<string>();
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql'))) {
      const sql = readFileSync(join(dir, f), 'utf8');
      for (const m of sql.matchAll(/revoke\s+select\s+on\s+(?:table\s+)?public\.([a-z_0-9]+)\s+from\s+[^;]*\banon\b/gi)) revoked.add(m[1]);
    }
    expect(revoked.size).toBeGreaterThan(0);
    for (const t of revoked) {
      expect(OPEN, t).not.toContain(t);
    }
  });
});
