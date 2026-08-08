import type { Metadata } from 'next';
import { getShareablesManifest, shareablesPublicUrl, type ShareablesClip } from '@/lib/shareables';
import { HowToShareModal } from '@/components/shareables/HowToShareModal';

export const metadata: Metadata = {
  title: 'Shareables | Bricks of India',
  description:
    'Free AI-animated LEGO minifigure greeting clips for every occasion — download and share on WhatsApp, Instagram, Facebook, or LinkedIn.',
  alternates: { canonical: 'https://bricksofindia.com/shareables' },
};

// Static/filesystem only, matching every other locked decision in this
// project — no database table, listing generated from manifest.json
// (same file scripts/shareables/postprocess.py reads), not Supabase.
const CATEGORY_COLOR: Record<string, string> = {
  'Flagship Website Intros': 'var(--boi-red)',
  'Festivals': 'var(--boi-saffron)',
  'Special / National Occasions': 'var(--boi-green)',
  'Personal Milestones & Family': 'var(--boi-blue)',
  'Everyday BOI': 'var(--boi-sky)',
  'Seasonal & Daily Expressions': 'var(--boi-navy)',
};

function ShareCard({ clip }: { clip: ShareablesClip }) {
  const color = CATEGORY_COLOR[clip.category] ?? 'var(--boi-navy)';
  const downloadName = `boi-${clip.slug}.mp4`;

  return (
    <div className="bg-white border-2 border-border rounded-2xl overflow-hidden flex flex-col h-full">
      {/* Thumbnail area — CSS-only placeholder (brand color block + occasion
          name); no per-clip thumbnail image exists yet since Phase 4
          (Kling generation) hasn't happened. Swap for a real still/GIF
          preview once real clips land. */}
      <div
        className="flex items-center justify-center text-center px-4"
        style={{ background: color, aspectRatio: '9 / 16', minHeight: '160px' }}
      >
        <span
          className="text-white text-lg leading-snug"
          style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, textShadow: '1px 1px 0 rgba(0,0,0,0.25)' }}
        >
          {clip.occasion}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <p className="font-body text-xs text-text-secondary line-clamp-2 flex-1">{clip.caption}</p>
        <a
          href={shareablesPublicUrl(clip)}
          download={downloadName}
          className="text-center text-sm font-bold px-3 py-2 rounded-xl text-white transition-opacity hover:opacity-90"
          style={{ background: 'var(--boi-red)', fontFamily: 'var(--font-fredoka)', fontWeight: 700 }}
        >
          Download →
        </a>
      </div>
    </div>
  );
}

export default function ShareablesPage() {
  const manifest = getShareablesManifest();

  // Preserve manifest order within each category (already document order
  // from the FINAL doc); group by category for section headers.
  const categories: { name: string; clips: ShareablesClip[] }[] = [];
  for (const clip of manifest.clips) {
    let section = categories.find((c) => c.name === clip.category);
    if (!section) {
      section = { name: clip.category, clips: [] };
      categories.push(section);
    }
    section.clips.push(clip);
  }

  return (
    <div className="bg-white min-h-screen">
      <section className="py-12 px-4" style={{ background: 'var(--boi-sky)' }}>
        <div className="max-w-site mx-auto flex flex-wrap items-center justify-between gap-4">
          <div>
            <span
              className="inline-block text-xs font-bold tracking-widest mb-3 px-3 py-1 rounded-full"
              style={{ background: 'var(--boi-green)', color: '#fff', letterSpacing: '0.1em' }}
            >
              SHAREABLES
            </span>
            <h1 className="font-heading text-6xl mb-2" style={{ color: 'var(--boi-navy)' }}>
              Shareables
            </h1>
            <p className="font-body text-lg" style={{ color: 'var(--boi-navy)', opacity: 0.75 }}>
              {manifest.clips.length} free BOI mascot greeting clips. Download, forward, done.
            </p>
          </div>
          <HowToShareModal />
        </div>
      </section>

      <div className="max-w-site mx-auto px-4 py-10 flex flex-col gap-12">
        {categories.map((section) => (
          <div key={section.name}>
            <h2
              className="text-2xl mb-4"
              style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, color: 'var(--boi-navy)' }}
            >
              {section.name}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
              {section.clips.map((clip) => (
                <ShareCard key={clip.id} clip={clip} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
