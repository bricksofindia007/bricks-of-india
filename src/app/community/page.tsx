import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { supabase } from '@/lib/supabase';
import { MASCOTS } from '@/lib/brand';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Indian LEGO Builder Spotlights — Community | Bricks of India',
  description: "Meet India's most remarkable LEGO builders. Profiles, MOCs, and the stories behind the brick rooms.",
  alternates: { canonical: 'https://bricksofindia.com/community' },
};

interface Spotlight {
  id: number;
  slug: string;
  builder_name: string;
  location: string | null;
  bio: string | null;
  photos: string[] | null;
  published_at: string;
}

export default async function CommunityPage() {
  const { data: spotlights } = await supabase
    .from('community_spotlights')
    .select('id, slug, builder_name, location, bio, photos, published_at')
    .eq('published', true)
    .order('published_at', { ascending: false });

  return (
    <div className="bg-white min-h-screen">
      {/* Hero */}
      <div className="py-12 px-4" style={{ background: 'var(--boi-navy)' }}>
        <div className="max-w-site mx-auto flex items-center gap-6">
          <div className="flex-1">
            <p className="font-body text-sm font-bold mb-2 uppercase tracking-widest" style={{ color: 'var(--boi-yellow)' }}>
              Builder Spotlights
            </p>
            <h1 className="font-heading text-6xl mb-3 text-white">COMMUNITY</h1>
            <p className="font-body text-lg max-w-xl" style={{ color: 'rgba(255,255,255,0.75)' }}>
              India&apos;s most remarkable LEGO builders — profiled, celebrated, and mildly interrogated about their set storage solutions.
            </p>
          </div>
          <Image
            src={MASCOTS.both.celebrate}
            alt="Community"
            width={180}
            height={180}
            className="object-contain shrink-0 hidden md:block"
          />
        </div>
      </div>

      <div className="max-w-site mx-auto px-4 py-10">
        {!spotlights || spotlights.length === 0 ? (
          <div className="text-center py-20">
            <Image
              src={MASCOTS.blue.phone}
              alt="Spotlights incoming"
              width={150}
              height={150}
              className="mx-auto mb-6 object-contain"
            />
            <h2 className="font-heading text-dark text-3xl mb-3">SPOTLIGHTS INCOMING</h2>
            <p className="text-gray-500 font-body text-lg max-w-md mx-auto mb-8">
              We&apos;re in the field, identifying and mildly interrogating India&apos;s most remarkable LEGO builders.
              First spotlights landing June 2026.
            </p>
            <Link
              href="/contact?subject=Builder+Spotlight+Feature"
              className="inline-block font-bold px-6 py-3 rounded-xl text-white text-sm"
              style={{ background: 'var(--boi-navy)' }}
            >
              Are you an Indian AFOL? Get in touch
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {spotlights.map((spotlight: Spotlight) => {
              const photos = Array.isArray(spotlight.photos) ? spotlight.photos : [];
              const coverPhoto = photos[0] ?? null;
              return (
                <Link
                  key={spotlight.id}
                  href={`/community/${spotlight.slug}`}
                  className="group block bg-white rounded-xl border border-border hover:border-primary transition-all duration-200 hover:shadow-lg overflow-hidden"
                >
                  <div className="relative bg-surface overflow-hidden" style={{ aspectRatio: '16/9' }}>
                    {coverPhoto ? (
                      <img
                        src={coverPhoto}
                        alt={spotlight.builder_name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--boi-sky)' }}>
                        <span className="text-5xl">🧱</span>
                      </div>
                    )}
                    <div className="absolute top-3 left-3">
                      <span
                        className="inline-block text-xs font-bold px-3 py-1 rounded-full"
                        style={{ background: 'var(--boi-yellow)', color: 'var(--boi-navy)' }}
                      >
                        Builder Spotlight
                      </span>
                    </div>
                  </div>
                  <div className="p-4">
                    <h3 className="font-heading text-dark text-2xl mb-1 group-hover:text-primary transition-colors">
                      {spotlight.builder_name}
                    </h3>
                    {spotlight.location && (
                      <p className="text-sm text-gray-400 mb-2 font-body">📍 {spotlight.location}</p>
                    )}
                    {spotlight.bio && (
                      <p className="text-sm text-gray-600 font-body line-clamp-2">{spotlight.bio}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-3">{formatDate(spotlight.published_at)}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
