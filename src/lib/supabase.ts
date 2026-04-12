import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase env vars: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set',
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server-side client — prefers service role key so it can bypass RLS for writes
export function createServerClient() {
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? supabaseAnonKey;
  return createClient(supabaseUrl, key);
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
  verdict: string;
  rating: number;
  youtube_url: string | null;
  published_at: string;
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
