/**
 * Pure checks behind scripts/ci/revalidate-audit.ts. No I/O here, so tests can call them directly.
 */

/**
 * Routes whose CI sample cannot return 200 on the zero-data stub (no theme has page 2 there). Their intended
 * revalidate is checked in source instead: the route file and its peers must export the registry value.
 */
export const EXPORT_CHECKED_ROUTES: Record<string, { file: string; peers: string[] }> = {
  '/themes/[theme]/page/[page]': {
    file: 'src/app/themes/[theme]/page/[page]/page.tsx',
    peers: ['src/app/themes/[theme]/page.tsx'],
  },
};

/** The value of a route file's `export const revalidate = N;`, or null when there is no such export. */
export function exportedRevalidate(src: string): number | null {
  const m = /^export const revalidate = (\d+);/m.exec(src);
  return m ? Number(m[1]) : null;
}

/** Problems with an export-checked route's revalidate exports. Empty when every file exports the intended value. */
export function exportProblems(route: string, intended: number, read: (file: string) => string | null): string[] {
  const { file, peers } = EXPORT_CHECKED_ROUTES[route];
  const problems: string[] = [];
  for (const f of [file, ...peers]) {
    const src = read(f);
    if (src === null) { problems.push(`${f} not found`); continue; }
    const exported = exportedRevalidate(src);
    if (exported === null) problems.push(`${f} has no 'export const revalidate'`);
    else if (exported !== intended) problems.push(`${f} exports ${exported}, intended ${intended}`);
  }
  return problems;
}

/** A sampled route passes only when it answers 200 and its measured cadence is the intended one. */
export function sampleOk(status: number, seconds: number | false | null, intended: number | false): boolean {
  return status === 200 && seconds === intended;
}
