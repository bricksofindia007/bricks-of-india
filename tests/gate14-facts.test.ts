import { describe, it, expect } from 'vitest';
import { resolveGate14Facts, catalogueFactsPrompt, gate14Feedback, isUnverifiableOnly, writeBackPieces } from '../src/lib/gate14-facts';
import { gate14Check } from '../src/lib/gate14';

// Minimal Supabase fake: each table returns canned data; update() records its call.
function fakeSb(tables: Record<string, unknown>, updateError: { code?: string; message: string } | null = null) {
  const calls: { table: string; update?: unknown; filters: string[] }[] = [];
  const sb = {
    from(table: string) {
      const rec = { table, filters: [] as string[] } as { table: string; update?: unknown; filters: string[] };
      calls.push(rec);
      const q: any = {
        select: () => q, eq: (c: string, v: string) => { rec.filters.push(`${c}=${v}`); return q; },
        or: (f: string) => { rec.filters.push(`or(${f})`); return q; },
        update: (u: unknown) => { rec.update = u; return q; },
        maybeSingle: () => Promise.resolve({ data: tables[table] ?? null, error: null }),
        then: (res: (v: unknown) => void) => res(rec.update ? { error: updateError } : { data: tables[table] ?? [], error: null }),
      };
      return q;
    },
  };
  return { sb, calls };
}
const okJson = (body: unknown) => Promise.resolve({ ok: true, json: () => Promise.resolve(body) });

describe('Gate 14 step 1b: facts, prompt, feedback, write-back (#398)', () => {
  it('uses the catalogue first and makes no API call when it has the facts', async () => {
    const { sb } = fakeSb({ sets: { set_number: '10305', name: "Lion Knights' Castle", pieces: 4514, minifigs: 22, year: 2022, lego_mrp_inr: 34999 }, store_prices: [{ price_inr: 32999 }], set_price_summary: { anchor_mrp_inr: 34999 } });
    let calls = 0;
    const r = await resolveGate14Facts(sb, '10305', { fetch: () => { calls++; return okJson({}); }, rebrickableKey: 'k', bricksetKey: 'k' });
    expect(calls).toBe(0);
    expect(r!.facts).toMatchObject({ pieces: 4514, minifigs: 22, year: 2022, prices: [32999], mrp: [34999, 34999] });
    expect(r!.piecesSource).toBe('sets');
  });

  it('falls back to Rebrickable for pieces and Brickset for minifigs when the catalogue has 0', async () => {
    const { sb } = fakeSb({ sets: { set_number: '71819', name: 'Dragon Stone Shrine', pieces: 0, minifigs: null, year: 2024, lego_mrp_inr: null }, store_prices: [], set_price_summary: null });
    const seen: string[] = [];
    const fetch = (u: string) => { seen.push(new URL(u).host); return u.includes('rebrickable') ? okJson({ num_parts: 1212 }) : okJson({ status: 'success', sets: [{ pieces: 1212, minifigs: 6 }] }); };
    const r = await resolveGate14Facts(sb, '71819', { fetch, rebrickableKey: 'k', bricksetKey: 'k' });
    expect(seen).toEqual(['rebrickable.com', 'brickset.com']);
    expect(r!.facts.pieces).toBe(1212); expect(r!.piecesSource).toBe('rebrickable');
    expect(r!.facts.minifigs).toBe(6); expect(r!.minifigsSource).toBe('brickset');
    expect(r!.catalogueHadPieces).toBe(false);
  });

  it('a failed lookup leaves the fact unknown (fail honest), and a claim about it is unverifiable', async () => {
    const { sb } = fakeSb({ sets: { set_number: '1', name: 'X', pieces: null, minifigs: null, year: null, lego_mrp_inr: null } });
    const r = await resolveGate14Facts(sb, '1', { fetch: () => Promise.reject(new Error('timeout')), rebrickableKey: 'k', bricksetKey: 'k' });
    expect(r!.facts.pieces).toBeNull();
    const findings = gate14Check('It has 500 pieces.', { ...r!.facts, verdict: null });
    expect(isUnverifiableOnly(findings)).toBe(true);
    expect(catalogueFactsPrompt(r!.facts)).toContain('pieces: UNKNOWN -- do not state a piece count');
  });

  it('the prompt lists the exact figures Gate 14 checks', () => {
    const p = catalogueFactsPrompt({ setNumber: '10305', name: "Lion Knights' Castle", pieces: 4514, minifigs: 22, year: 2022, prices: [32999, 32999], mrp: [34999], verdict: null });
    expect(p).toContain('pieces: 4514'); expect(p).toContain('minifigures: 22'); expect(p).toContain('release year: 2022');
    expect(p).toContain('India prices (₹): 32,999'); expect(p).toContain('MRP (₹): 34,999');
    expect(p).toMatch(/Exactly one verdict line/);
  });

  it('feedback names each finding for the shared regeneration; contradicted facts are not "unverifiable only"', () => {
    const findings = gate14Check('It has 5,000 pieces.\nVerdict: BUY NOW\nWAIT', { setNumber: '10305', name: 'X', pieces: 4514, minifigs: 22, year: 2022, prices: [], mrp: [], verdict: 'BUY NOW' });
    expect(findings.map((x) => x.rule).sort()).toEqual(['pieces', 'verdict']);
    const fb = gate14Feedback(findings);
    expect(fb).toMatch(/^Gate 14 \(fact check\) failed/); expect(fb).toContain('[pieces]'); expect(fb).toContain('[verdict]');
    expect(isUnverifiableOnly(findings)).toBe(false);
    expect(isUnverifiableOnly([])).toBe(false);
  });

  it('write-back: only for a 0/NULL catalogue count, guarded in SQL, with a dated source', async () => {
    const base = { facts: { setNumber: '71819', name: 'X', pieces: 1212, minifigs: null, year: null, prices: [], mrp: [], verdict: null }, minifigsSource: null } as const;
    const had = fakeSb({});
    expect(await writeBackPieces(had.sb, { ...base, piecesSource: 'sets', catalogueHadPieces: true })).toBe('not-needed');
    expect(had.calls.length).toBe(0);

    const ok = fakeSb({});
    expect(await writeBackPieces(ok.sb, { ...base, piecesSource: 'rebrickable', catalogueHadPieces: false }, new Date('2026-09-28T12:00:00Z'))).toBe('written');
    expect(ok.calls[0].update).toMatchObject({ pieces: 1212, pieces_source: 'Rebrickable (Gate 14 write-back, 2026-09-28)' });
    expect(ok.calls[0].filters).toEqual(['set_number=71819', 'or(pieces.is.null,pieces.eq.0)']);

    const noCol = fakeSb({}, { code: '42703', message: 'column "pieces_source" does not exist' });
    expect(await writeBackPieces(noCol.sb, { ...base, piecesSource: 'brickset', catalogueHadPieces: false })).toBe('no-column');
  });
});
