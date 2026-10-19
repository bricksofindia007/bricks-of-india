import { isThemeSort, themeHref, type ThemeSort } from '@/lib/theme-paging';

/**
 * Where an old query-string theme address goes: /themes/<slug>?page=N and ?sort=X become the path form, with no query.
 * Returns null when the request has neither parameter (so the middleware leaves it alone).
 * Page 1, a page that is not a number, and an unknown sort all fall back to the bare theme address or the default sort.
 */
export function themeRedirectTarget(pathname: string, search: URLSearchParams): string | null {
  const m = pathname.match(/^\/themes\/([^/]+)\/?$/);
  if (!m) return null;
  const slug = m[1];
  const sortRaw = search.get('sort');
  const pageRaw = search.get('page');
  if (sortRaw === null && pageRaw === null) return null;
  const sort: ThemeSort | undefined = sortRaw && isThemeSort(sortRaw) ? sortRaw : undefined;
  const page = pageRaw && /^\d+$/.test(pageRaw) && Number(pageRaw) > 1 ? Number(pageRaw) : undefined;
  return themeHref(slug, { page, sort });
}
