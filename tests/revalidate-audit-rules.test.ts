// The revalidate audit's row rules (scripts/ci/revalidate-audit-rules.ts). The per-page theme route is decided by its
// revalidate exports, not by the zero-data stub's status. Every other sampled route still needs HTTP 200 at its cadence.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { EXPORT_CHECKED_ROUTES, exportedRevalidate, exportProblems, sampleOk } from '../scripts/ci/revalidate-audit-rules';

const root = join(__dirname, '..');
const ROUTE = '/themes/[theme]/page/[page]';
const PAGE = 'src/app/themes/[theme]/page/[page]/page.tsx';
const THEME = 'src/app/themes/[theme]/page.tsx';

const files = (over: Record<string, string | null> = {}) => (f: string) =>
  f in over ? over[f] : f === PAGE ? 'export const revalidate = 86400;\n' : f === THEME ? 'export const revalidate = 86400;\n' : null;

describe('export check on the per-page theme route', () => {
  it('the real route files export the intended value, so the route passes', () => {
    const read = (f: string) => (existsSync(join(root, f)) ? readFileSync(join(root, f), 'utf8') : null);
    expect(exportProblems(ROUTE, 86400, read)).toEqual([]);
  });
  it('a missing revalidate export on the route fails the audit', () => {
    const p = exportProblems(ROUTE, 86400, files({ [PAGE]: 'export default function P() { return null; }\n' }));
    expect(p).toEqual([`${PAGE} has no 'export const revalidate'`]);
  });
  it('a wrong revalidate export on the route fails the audit', () => {
    const p = exportProblems(ROUTE, 86400, files({ [PAGE]: 'export const revalidate = 21600;\n' }));
    expect(p).toEqual([`${PAGE} exports 21600, intended 86400`]);
  });
  it('a wrong export on the /themes/[theme] peer fails the audit too', () => {
    const p = exportProblems(ROUTE, 86400, files({ [THEME]: 'export const revalidate = 3600;\n' }));
    expect(p).toEqual([`${THEME} exports 3600, intended 86400`]);
  });
  it('a missing route file fails the audit', () => {
    expect(exportProblems(ROUTE, 86400, files({ [PAGE]: null }))).toEqual([`${PAGE} not found`]);
  });
  it('parses the export only at the start of a line, so a comment mentioning it does not count', () => {
    expect(exportedRevalidate('// export const revalidate = 86400;\n')).toBeNull();
    expect(exportedRevalidate('export const revalidate = 86400;\n')).toBe(86400);
  });
  it('only the theme page-number and sorted routes are exempt from the sample status (the stub has no theme data there), and no other route is', () => {
    expect(Object.keys(EXPORT_CHECKED_ROUTES).sort()).toEqual([ROUTE, '/themes/[theme]/sort/[sort]', '/themes/[theme]/sort/[sort]/page/[page]'].sort());
  });
});

describe('HTTP status gate on every other sampled route', () => {
  it('a 404 fails', () => {
    expect(sampleOk(404, 86400, 86400)).toBe(false);
  });
  it('a 500 fails', () => {
    expect(sampleOk(500, 86400, 86400)).toBe(false);
  });
  it('a 200 at the wrong cadence fails', () => {
    expect(sampleOk(200, 3600, 86400)).toBe(false);
  });
  it('a 200 at the intended cadence passes', () => {
    expect(sampleOk(200, 86400, 86400)).toBe(true);
  });
});
