import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const MIGRATION = resolve(__dirname, '../supabase/migrations/20261016120000_review_publish_gate.sql');
const ROLLBACK = resolve(__dirname, '../docs/data-fix-rollbacks/review-publish-gate-rollback.sql');
const sql = readFileSync(MIGRATION, 'utf8');

describe('review publish gate migration', () => {
  it('has an issue header and no transaction statements outside the function body', () => {
    expect(sql).toMatch(/^-- boi:issue 599$/m);
    expect(sql).not.toMatch(/placeholder/i);
    const outside = sql.replace(/\$([a-z]*)\$[\s\S]*?\$\1\$/g, '');
    expect(outside).not.toMatch(/^\s*(BEGIN|COMMIT|ROLLBACK)\b/im);
  });

  it('fires on insert and on publish or verdict change, not on content updates', () => {
    expect(sql).toMatch(/BEFORE INSERT OR UPDATE OF published_at, verdict ON public\.reviews/);
    expect(sql).not.toMatch(/UPDATE OF[^;]*content/);
  });

  it('refuses publish without a confirmed source and without a store listing', () => {
    expect(sql).toContain('no confirmed retailer source');
    expect(sql).toContain('NEW.source_retailer IS NULL OR NEW.source_price_inr IS NULL OR NEW.source_checked_at IS NULL');
    expect(sql).toContain('no store listing');
  });

  it('refuses BUY NOW unless the set has an in-stock listing', () => {
    expect(sql).toContain("NEW.verdict = 'BUY NOW'");
    expect(sql).toContain('sp.in_stock');
    expect(sql).toContain('cannot be BUY NOW');
  });

  it('uses the default error code, not a class-23 integrity code', () => {
    expect(sql).not.toMatch(/ERRCODE/);
  });

  it('keeps the function private and sets an empty search path', () => {
    expect(sql).toContain("SET search_path = ''");
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.review_publish_gate() FROM PUBLIC');
  });

  it('has a rollback that drops the trigger and function and nothing else', () => {
    expect(existsSync(ROLLBACK)).toBe(true);
    const rb = readFileSync(ROLLBACK, 'utf8');
    expect(rb).toContain('DROP TRIGGER IF EXISTS review_publish_gate ON public.reviews');
    expect(rb).toContain('DROP FUNCTION IF EXISTS public.review_publish_gate()');
    expect(rb).not.toMatch(/UPDATE|DELETE|INSERT/);
  });
});
