import Image from 'next/image';
import Link from 'next/link';
import { createServerClient } from '@/lib/supabase';

const YOUTUBE_CHANNEL = 'https://www.youtube.com/@BricksofIndia';

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export async function YoutubeStrip() {
  const supabase = createServerClient();

  // Fetch more than needed — deduplicate by external_id in JS since PostgREST
  // lacks DISTINCT ON and the same video appears once per RADAR-01 run.
  const { data: rows } = await supabase
    .from('raw_signals')
    .select('id, external_id, url, title, source_name, published_at')
    .eq('source_type', 'youtube')
    .not('external_id', 'is', null)
    .order('published_at', { ascending: false })
    .limit(50);

  // Deduplicate by external_id, keep the most recent occurrence
  const seen = new Set<string>();
  const videos: NonNullable<typeof rows> = [];
  for (const row of rows ?? []) {
    if (row.external_id && !seen.has(row.external_id)) {
      seen.add(row.external_id);
      videos.push(row);
      if (videos.length === 5) break;
    }
  }

  if (videos.length === 0) return null;

  return (
    <section className="py-12 px-4 bg-white border-t border-border">
      <div className="max-w-site mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-heading text-dark text-4xl">LATEST FROM THE COMMUNITY</h2>
          <a
            href={YOUTUBE_CHANNEL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-bold hover:underline text-sm shrink-0"
          >
            See all videos →
          </a>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {videos.map((v) => (
            <a
              key={v.external_id}
              href={v.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block rounded-xl overflow-hidden border border-border hover:border-primary hover:shadow-md transition-all duration-200"
            >
              {/* Thumbnail */}
              <div className="relative bg-dark" style={{ aspectRatio: '16/9' }}>
                <Image
                  src={`https://img.youtube.com/vi/${v.external_id}/mqdefault.jpg`}
                  alt={v.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  unoptimized
                />
                {/* Play overlay */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <div className="w-10 h-10 rounded-full bg-[#FF0000] flex items-center justify-center">
                    <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-xs text-gray-400 mb-1">{v.source_name}</p>
                <p className="font-bold text-dark text-xs leading-snug line-clamp-2 group-hover:text-primary transition-colors mb-1">
                  {v.title}
                </p>
                <p className="text-xs text-gray-400">{formatDate(v.published_at)}</p>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
