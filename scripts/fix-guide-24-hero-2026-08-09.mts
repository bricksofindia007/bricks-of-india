/**
 * One-off correction: guide id=24 (published during the §5 end-to-end
 * proof, 2026-08-09) got hero_image/featured_image_url =
 * https://bricksofindia.com/assets/og-image.jpg because resolveHeroImage()
 * fetched its own synthetic same-site source_url before the own-domain
 * fix landed. Re-resolves via the corrected chain and applies the result.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveHeroImage } from '../src/lib/publish-draft';

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(__dirname, '../.env.local'), 'utf-8');
for (const line of raw.split('\n')) {
  const t = line.trim();
  if (!t || t.startsWith('#')) continue;
  const eq = t.indexOf('=');
  if (eq < 0) continue;
  const k = t.slice(0, eq).trim(), v = t.slice(eq + 1).trim();
  if (!process.env[k]) process.env[k] = v;
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

(async () => {
  const { data: guide, error } = await sb.from('guides').select('id, slug, title, content, hero_image, featured_image_url').eq('id', 24).single();
  if (error) throw error;
  console.log('before:', guide.hero_image, '/', guide.featured_image_url);

  const resolved = await resolveHeroImage(
    'https://bricksofindia.com/guides#topic-lego-duplo-vs-classic-toddlers-india',
    guide.title, guide.title, guide.content, 'guides', sb,
  );
  console.log('resolved:', resolved);

  const { error: updErr } = await sb.from('guides').update({ hero_image: resolved, featured_image_url: resolved }).eq('id', 24).select('id, hero_image, featured_image_url');
  if (updErr) throw updErr;

  const { data: after } = await sb.from('guides').select('hero_image, featured_image_url').eq('id', 24).single();
  console.log('after:', after?.hero_image, '/', after?.featured_image_url);
})().catch(err => { console.error('FATAL:', err); process.exit(1); });
