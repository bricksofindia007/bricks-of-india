// Collectible minifigures (CMF) saved by a visitor: kept in the browser by figure id. Figures only; other
// minifigures have no table yet. The batched read selects only the columns that exist in cmf_figures. There is
// no price column, so no price is ever shown.
import { readList, writeList } from './my-collection';

export const FIGURE_KEY = 'boi_cmf_figures';
export const FIGURE_LIMIT = 500;
export const FIGURE_READ_CAP = 150;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FigureRef = { id: string; added_at: string };

export type FigureRow = {
  id: string;
  figure_number: string;
  name: string;
  series_name: string;
  series_set_number: string;
  image_url: string | null;
  year: number | null;
};

export const FIGURE_COLUMNS = 'id, figure_number, name, series_name, series_set_number, image_url, year';

/** Well-formed rows only, one per figure id, capped. */
export function cleanFigures(raw: unknown): FigureRef[] {
  const seen = new Set<string>();
  const out: FigureRef[] = [];
  for (const r of Array.isArray(raw) ? raw : []) {
    if (!r || typeof r.id !== 'string' || !UUID.test(r.id) || seen.has(r.id)) continue;
    seen.add(r.id);
    const t = typeof r.added_at === 'string' ? Date.parse(r.added_at) : NaN;
    out.push({ id: r.id.toLowerCase(), added_at: Number.isFinite(t) ? new Date(t).toISOString() : new Date(0).toISOString() });
  }
  return out.slice(0, FIGURE_LIMIT);
}

export function addFigure(list: FigureRef[], id: string, now: string): { list: FigureRef[]; status: 'added' | 'present' | 'limit' } {
  const key = id.toLowerCase();
  if (list.some((f) => f.id === key)) return { list, status: 'present' };
  if (list.length >= FIGURE_LIMIT) return { list, status: 'limit' };
  return { list: [{ id: key, added_at: now }, ...list], status: 'added' };
}

export function removeFigure(list: FigureRef[], id: string): FigureRef[] {
  return list.filter((f) => f.id !== id.toLowerCase());
}

export const loadFigures = (): FigureRef[] => cleanFigures(readList(FIGURE_KEY));
export const saveFigures = (list: FigureRef[]): boolean => writeList(FIGURE_KEY, list);

/** Ids split into read batches of at most FIGURE_READ_CAP. */
export function figureBatches(ids: string[], cap: number = FIGURE_READ_CAP): string[][] {
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += cap) out.push(ids.slice(i, i + cap));
  return out;
}

/** Minimal shape of the anonymous client used here (only what is called). */
export interface FigureReader {
  from(table: 'cmf_figures'): {
    select(columns: string): { in(column: 'id', values: string[]): PromiseLike<{ data: FigureRow[] | null; error: { message: string } | null }> };
  };
}

/**
 * Reads the saved figures in batches. Returns the rows found, or null when any batch fails: the page then says
 * figures are unavailable and shows no figure rows. Never a guessed row.
 */
export async function readFigures(sb: FigureReader, ids: string[]): Promise<FigureRow[] | null> {
  const rows: FigureRow[] = [];
  for (const batch of figureBatches(ids)) {
    const { data, error } = await sb.from('cmf_figures').select(FIGURE_COLUMNS).in('id', batch);
    if (error || !data) return null;
    rows.push(...data);
  }
  return rows;
}
