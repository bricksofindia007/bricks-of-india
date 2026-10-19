'use client';

import { THEME_SORT_OPTIONS, type ThemeSort } from '@/lib/theme-paging';

interface ThemeSortSelectProps {
  slug: string;
  sort: ThemeSort;
}

// A GET form: the sort goes in the query string and the page number is left out, so a change of sort starts at page 1.
// The submit button is for browsers without script; with script, a change of the select submits the form itself.
export function ThemeSortSelect({ slug, sort }: ThemeSortSelectProps) {
  return (
    <form action={`/themes/${slug}`} method="get" className="flex items-center gap-2">
      <label htmlFor="theme-sort" className="text-sm font-bold text-dark shrink-0">
        Sort by:
      </label>
      <select
        id="theme-sort"
        name="sort"
        defaultValue={sort}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="text-sm border border-border rounded-lg px-3 py-1.5 bg-white text-dark focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
      >
        {THEME_SORT_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="text-sm font-bold text-primary underline">Apply</button>
      </noscript>
    </form>
  );
}
