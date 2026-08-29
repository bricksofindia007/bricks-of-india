import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';
import { JsonLd } from '@/components/JsonLd';

// Durable-cache guard (2026-07-02 convention, applied here 2026-08-29):
// Netlify's Next runtime persists rendered pages ACROSS deploys when no
// revalidate is set. Hourly ISR caps staleness at 60 min, permanently.
export const revalidate = 3600;

// Netlify credit audit (2026-08-29): this route had neither revalidate
// nor generateStaticParams — confirmed via a real production build as
// full SSR (`ƒ`) on every request, same root cause as /news/[slug] and
// /reviews/[slug] (see /news/[slug] for the full explanation). Empty
// array: community_spotlights is 0 rows as of this audit, so this is a
// correctness/consistency fix more than an active cost saver right now —
// but it closes the gap before the section gets seeded.
export async function generateStaticParams() {
  return [];
}

interface Props { params: { slug: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { data: spotlight } = await supabase
    .from('community_spotlights')
    .select('builder_name, location, bio')
    .eq('slug', params.slug)
    .eq('published', true)
    .single();
  if (!spotlight) return { title: 'Builder Not Found' };
  return {
    title: `${spotlight.builder_name} — Indian LEGO Builder Spotlight | Bricks of India`,
    description:
      spotlight.bio?.slice(0, 155) ||
      `Meet ${spotlight.builder_name}, an Indian LEGO builder featured on Bricks of India.`,
    alternates: { canonical: `https://bricksofindia.com/community/${params.slug}` },
  };
}

export default async function SpotlightPage({ params }: Props) {
  const { data: spotlight } = await supabase
    .from('community_spotlights')
    .select('*')
    .eq('slug', params.slug)
    .eq('published', true)
    .single();

  if (!spotlight) notFound();

  const photos: string[] = Array.isArray(spotlight.photos) ? spotlight.photos : [];

  const personSchema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: spotlight.builder_name,
    ...(spotlight.location && {
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'IN',
        addressLocality: spotlight.location,
      },
    }),
    ...(spotlight.bio && { description: spotlight.bio }),
  };

  return (
    <div className="bg-white min-h-screen">
      <JsonLd data={personSchema} />

      {/* Breadcrumb */}
      <div className="max-w-site mx-auto px-4 py-6">
        <nav className="text-sm text-gray-400 flex items-center gap-2">
          <Link href="/" className="hover:text-primary">Home</Link>
          <span>/</span>
          <Link href="/community" className="hover:text-primary">Community</Link>
          <span>/</span>
          <span className="text-dark font-bold truncate">{spotlight.builder_name}</span>
        </nav>
      </div>

      {/* Hero — cover photo with navy overlay, or solid navy */}
      <div
        className="w-full flex items-end px-4"
        style={{
          background: photos[0]
            ? `linear-gradient(to bottom, rgba(15,45,107,0.35), rgba(15,45,107,0.88)), url('${photos[0]}') center/cover no-repeat`
            : 'var(--boi-navy)',
          minHeight: '260px',
          paddingTop: '3rem',
          paddingBottom: '3rem',
        }}
      >
        <div className="max-w-site mx-auto w-full">
          <p className="text-sm font-bold mb-2 uppercase tracking-widest" style={{ color: 'var(--boi-yellow)' }}>
            Builder Spotlight
          </p>
          <h1 className="font-heading text-white text-5xl md:text-6xl mb-2">
            {spotlight.builder_name}
          </h1>
          {spotlight.location && (
            <p className="font-body" style={{ color: 'rgba(255,255,255,0.75)' }}>
              📍 {spotlight.location}
            </p>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Bio */}
        {spotlight.bio && (
          <div className="prose prose-gray max-w-none font-body leading-relaxed text-gray-700 mb-10">
            <p className="text-lg">{spotlight.bio}</p>
          </div>
        )}

        {/* Photo gallery — skip first photo (used as hero) */}
        {photos.length > 1 && (
          <div className="mb-10">
            <h2 className="font-heading text-dark text-3xl mb-4">BUILDS</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {photos.slice(1).map((url, i) => (
                <div key={i} className="aspect-square rounded-xl overflow-hidden bg-surface">
                  <img
                    src={url}
                    alt={`${spotlight.builder_name} build ${i + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-400 mt-4">
          Published {formatDate(spotlight.published_at)}
        </p>

        {/* CTA */}
        <div
          className="mt-10 p-6 rounded-2xl border-2"
          style={{ borderColor: 'var(--boi-yellow)', background: 'rgba(247,168,0,0.07)' }}
        >
          <h3 className="font-heading text-dark text-2xl mb-2">ARE YOU AN INDIAN LEGO BUILDER?</h3>
          <p className="font-body text-gray-600 mb-4">
            We&apos;re looking for remarkable Indian AFOLs to feature. If you build, collect, or create MOCs and you&apos;re based in India — we want to hear from you. Your wallet&apos;s suffering deserves to be documented.
          </p>
          <Link
            href="/contact?subject=Builder+Spotlight+Feature"
            className="inline-block font-bold px-6 py-3 rounded-xl text-white text-sm"
            style={{ background: 'var(--boi-navy)' }}
          >
            Get in touch
          </Link>
        </div>

        <div className="mt-8">
          <Link
            href="/community"
            className="text-sm font-bold hover:underline"
            style={{ color: 'var(--boi-navy)' }}
          >
            ← Back to all spotlights
          </Link>
        </div>
      </div>
    </div>
  );
}
