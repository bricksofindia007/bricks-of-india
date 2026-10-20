import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { THEMES } from '@/lib/brand';
import { loadThemeView } from '@/lib/theme-page-data';
import { themeRouteMetadata } from '@/lib/theme-metadata';
import { ThemePageBody } from '@/components/themes/ThemePageBody';

// Page one in the default sort is static and rebuilt on the price cadence (see route-cadence.ts).
// Pages 2 and up: /themes/[theme]/page/[n]. Sorted views: /themes/[theme]/sort/[sort].
export const revalidate = 86400;

interface Props {
  params: Promise<{ theme: string }>;
}

export async function generateStaticParams() {
  return THEMES.map((t) => ({ theme: t.slug }));
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { theme } = await props.params;
  return themeRouteMetadata(theme, 1, null);
}

export default async function ThemePage(props: Props) {
  const { theme } = await props.params;
  const view = await loadThemeView(theme, 'year-desc', 1);
  if (!view) notFound();
  return <ThemePageBody view={view} />;
}
