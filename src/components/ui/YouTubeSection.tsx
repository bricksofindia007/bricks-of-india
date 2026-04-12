'use client';

import { useState } from 'react';
import Image from 'next/image';
import { BRAND } from '@/lib/brand';

// Replace video IDs as needed. Find ID from: https://www.youtube.com/@BricksofIndia
// URL: https://www.youtube.com/watch?v=ABC123XYZ  ->  ID is "ABC123XYZ"
const VIDEOS = [
  {
    id: 'V2RuwgOANPA',
    title: 'BRAD PITT in LEGO?! The RAREST Speed Champions F1 Set Review 77252',
  },
  {
    id: 'KVj4n5CQqmQ',
    title: 'Mission LEGO Impossible: My Craziest LEGO Hunt Ever for Retired Sets!',
  },
  {
    id: '72_6dwxsd3o',
    title: 'This Tiny LEGO Car Is a Trap — F1 Academy Mini Car Speed Champions #30734',
  },
];

function PlayIcon() {
  return (
    <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.5 6.2c-.3-1-1-1.8-2-2.1C19.7 3.7 12 3.7 12 3.7s-7.7 0-9.5.4c-1 .3-1.7 1.1-2 2.1C0 8 0 12 0 12s0 4 .5 5.8c.3 1 1 1.8 2 2.1C4.3 20.3 12 20.3 12 20.3s7.7 0 9.5-.4c1-.3 1.7-1.1 2-2.1C24 16 24 12 24 12s0-4-.5-5.8zM9.7 15.5V8.5l6.3 3.5-6.3 3.5z" />
    </svg>
  );
}

interface VideoCardProps {
  video: { id: string; title: string };
  onPlay: (id: string) => void;
}

function VideoCard({ video, onPlay }: VideoCardProps) {
  return (
    <button
      onClick={() => onPlay(video.id)}
      className="group w-full text-left bg-white/5 rounded-xl overflow-hidden border border-white/10 hover:border-white/30 transition-all duration-200 hover:shadow-2xl hover:-translate-y-1"
    >
      <div className="relative overflow-hidden" style={{ aspectRatio: '16/9' }}>
        <Image
          src={`https://img.youtube.com/vi/${video.id}/maxresdefault.jpg`}
          alt={video.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          unoptimized
        />
        <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-[#FF0000] flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-200">
            <PlayIcon />
          </div>
        </div>
      </div>
      <div className="p-4">
        <p className="text-white font-bold text-sm leading-snug line-clamp-2 group-hover:text-accent transition-colors">
          {video.title}
        </p>
      </div>
    </button>
  );
}

interface ModalProps {
  videoId: string;
  onClose: () => void;
}

function VideoModal({ videoId, onClose }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/70 hover:text-white font-bold text-sm flex items-center gap-1 transition-colors"
        >
          <span>x Close</span>
        </button>
        <div className="relative rounded-xl overflow-hidden shadow-2xl" style={{ aspectRatio: '16/9' }}>
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}

export function YouTubeSection() {
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  return (
    <>
      <section className="py-16 px-4 bg-primary-dark">
        <div className="max-w-site mx-auto">
          <div className="text-center mb-10">
            <h2 className="font-heading text-accent text-5xl mb-3">WATCH BEFORE YOU BUY</h2>
            <p className="text-white/70 max-w-2xl mx-auto font-body text-lg">
              Set reviews, unboxings, and honest opinions on LEGO in India. No fluff. Just bricks.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-10">
            {VIDEOS.map((video) => (
              <VideoCard key={video.id + video.title} video={video} onPlay={setActiveVideo} />
            ))}
          </div>

          <div className="text-center">
            <a
              href={BRAND.youtube}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-[#FF0000] text-white font-bold px-8 py-4 rounded-xl hover:bg-red-700 transition-colors text-base"
            >
              <YouTubeIcon />
              Subscribe on YouTube
            </a>
          </div>
        </div>
      </section>

      {activeVideo && (
        <VideoModal videoId={activeVideo} onClose={() => setActiveVideo(null)} />
      )}
    </>
  );
}
