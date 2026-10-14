import { createClient } from '@supabase/supabase-js';
import { READ_REVALIDATE_SECONDS } from './price-freshness';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set',
  );
}

// Only initialise the anon client if the URL is present.
// createClient('', ...) throws synchronously and crashes the module.
export const supabase = supabaseUrl
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as any);

// Per-read Data Cache lifetime for ISR routes (PR-A, 2026-09-26). Replaces
// `export const fetchCache = 'default-cache'`, which cached every Supabase
// read with revalidate=INFINITE_CACHE -- i.e. until the next deploy -- so an
// hourly ISR regeneration re-rendered the page from week-old prices. With an
// explicit revalidate the read is still cached (route stays ISR, #105) but
// expires on the same hourly clock as the page.
function revalidatingFetch(seconds: number): typeof fetch {
  return (input, init) => fetch(input, { ...init, next: { revalidate: seconds } } as RequestInit);
}

/** Anon client for ISR routes: every read expires after READ_REVALIDATE_SECONDS. */
export const supabaseRead = supabaseUrl
  ? createClient(supabaseUrl, supabaseAnonKey, { global: { fetch: revalidatingFetch(READ_REVALIDATE_SECONDS) } })
  : (null as any);

/**
 * Service-role client. Pass `{ revalidate }` on ISR routes so reads expire
 * (see revalidatingFetch); omit it for writes, actions and dynamic routes.
 */
export function createServerClient(opts?: { revalidate?: number }) {
  if (!supabaseUrl) throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set — check Netlify environment variables');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY required for server client — refusing to fall back to anon key');
  }
  return opts?.revalidate != null
    ? createClient(supabaseUrl, serviceKey, { global: { fetch: revalidatingFetch(opts.revalidate) } })
    : createClient(supabaseUrl, serviceKey);
}

// Types matching our schema
export interface LegoSet {
  id: string;
  set_number: string;
  name: string;
  theme: string;
  subtheme: string | null;
  year: number;
  pieces: number | null;
  minifigs: number | null;
  image_url: string | null;
  description: string | null;
  age_range: string | null;
  lego_mrp_inr: number | null;
  mrp_verified: boolean;
  rebrickable_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Price {
  id: string;
  set_id: string;
  store_name: string;
  store_url: string;
  price_inr: number | null;
  availability: 'in_stock' | 'out_of_stock' | 'unknown';
  buy_url: string;
  scraped_at: string;
  is_active: boolean;
}

export interface Review {
  id: string;
  set_id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  verdict: string;
  rating: number;
  youtube_url: string | null;
  hero_image: string | null;
  seo_title: string | null;
  seo_description: string | null;
  published_at: string;
  updated_at: string;
  created_at: string;
}

export interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  excerpt: string;
  hero_image: string | null;
  published_at: string;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  excerpt: string;
  hero_image: string | null;
  published_at: string;
  seo_title: string | null;
  seo_description: string | null;
  created_at: string;
}

export interface Guide {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  category: string | null;
  featured_image_url: string | null;
  read_time_minutes: number | null;
  published_at: string;
  updated_at: string;
}
