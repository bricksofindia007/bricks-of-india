// Collectible minifigures (CMF): browser-local saves by figure id, the 500 limit, batches of 150, the batched read
// (columns that exist, no price), a failed read shows no rows, and the anonymous read grant in the migrations.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  cleanFigures, addFigure, removeFigure, figureBatches, readFigures, FIGURE_COLUMNS, FIGURE_LIMIT, FIGURE_READ_CAP, type FigureRow, type FigureReader,
} from '../src/lib/cmf-figures';

const root = join(__dirname, '..');
const NOW = '2026-10-18T09:00:00.000Z';
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

describe('saved figures, by id', () => {
  it('keeps well-formed ids only, one per id, lower-cased', () => {
    const out = cleanFigures([{ id: uuid(1), added_at: NOW }, { id: uuid(1) }, { id: 'not-a-uuid' }, null, { id: uuid(2).toUpperCase(), added_at: NOW }]);
    expect(out.map((f) => f.id)).toEqual([uuid(1), uuid(2)]);
  });
  it('adds a figure once; a repeat is "present"', () => {
    const a = addFigure([], uuid(1), NOW);
    expect(a.status).toBe('added');
    expect(addFigure(a.list, uuid(1), NOW).status).toBe('present');
  });
  it('the limit is 500 figures', () => {
    expect(FIGURE_LIMIT).toBe(500);
    const full = Array.from({ length: FIGURE_LIMIT }, (_, i) => ({ id: uuid(i + 1), added_at: NOW }));
    expect(addFigure(full, uuid(9999), NOW).status).toBe('limit');
    expect(cleanFigures([...full, { id: uuid(9999), added_at: NOW }]).length).toBe(FIGURE_LIMIT);
  });
  it('removing by id', () => {
    expect(removeFigure([{ id: uuid(1), added_at: NOW }], uuid(1))).toEqual([]);
  });
});

describe('batched read', () => {
  it('batches of at most 150 ids, covering every id once', () => {
    expect(FIGURE_READ_CAP).toBe(150);
    const ids = Array.from({ length: 320 }, (_, i) => uuid(i));
    const b = figureBatches(ids);
    expect(b.map((x) => x.length)).toEqual([150, 150, 20]);
    expect(b.flat()).toEqual(ids);
  });
  it('reads only the columns that exist in the table, and no price column', () => {
    expect(FIGURE_COLUMNS.split(',').map((c) => c.trim())).toEqual(['id', 'figure_number', 'name', 'series_name', 'series_set_number', 'image_url', 'year']);
    expect(FIGURE_COLUMNS).not.toMatch(/price/i);
  });
  it('returns the rows, and asks for each batch with the id column', async () => {
    const calls: Array<{ columns: string; ids: string[] }> = [];
    const sb: FigureReader = {
      from: () => ({
        select: (columns: string) => ({
          in: async (_col: 'id', values: string[]) => {
            calls.push({ columns, ids: values });
            const rows = values.map((id) => ({ id, figure_number: 'x', name: 'n', series_name: 's', series_set_number: '1', image_url: null, year: 2024 })) as FigureRow[];
            return { data: rows, error: null };
          },
        }),
      }),
    };
    const ids = Array.from({ length: 151 }, (_, i) => uuid(i));
    const rows = await readFigures(sb, ids);
    expect(rows).toHaveLength(151);
    expect(calls.map((c) => c.ids.length)).toEqual([150, 1]);
    expect(calls.every((c) => c.columns === FIGURE_COLUMNS)).toBe(true);
  });
  it('a failed batch returns null: no figure rows are guessed', async () => {
    const sb: FigureReader = { from: () => ({ select: () => ({ in: async () => ({ data: null, error: { message: 'down' } }) }) }) };
    expect(await readFigures(sb, [uuid(1)])).toBeNull();
  });
  it('no saved figures: an empty list, no read', async () => {
    const sb: FigureReader = { from: () => { throw new Error('should not read'); } };
    expect(await readFigures(sb, [])).toEqual([]);
  });
});

describe('anonymous reads are allowed by the migrations', () => {
  const baseline = readFileSync(join(root, 'supabase/migrations/20260927140000_baseline.sql'), 'utf8');
  it('the table grants SELECT to anon and has a public-read policy', () => {
    expect(baseline).toMatch(/GRANT SELECT,INSERT,DELETE,MAINTAIN,UPDATE ON TABLE public\.cmf_figures TO anon;/);
    expect(baseline).toMatch(/CREATE POLICY cmf_figures_public_read ON public\.cmf_figures FOR SELECT USING \(true\);/);
  });
  it('the write-revoke migration keeps SELECT (its own comment says so)', () => {
    const fp33 = readFileSync(join(root, 'supabase/migrations/20260927213000_fp33_revoke_anon_authenticated_writes.sql'), 'utf8');
    expect(fp33).toMatch(/SELECT grants are untouched/);
  });
});

describe('the list shows no price', () => {
  it('the list component has no price text in its rendering', () => {
    // Comments and CSS class names are not shown text; only what renders is checked.
    const src = readFileSync(join(root, 'src/app/my/FiguresList.tsx'), 'utf8').replace(/\/\/.*$/gm, '').replace(/className="[^"]*"/g, '');
    expect(src).not.toMatch(/price|₹|Rs /i);
  });
});
