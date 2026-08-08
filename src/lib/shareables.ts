import fs from 'fs';
import path from 'path';

// Reads scripts/shareables/manifest.json — the SAME manifest Phase 5's
// postprocess.py reads, not a duplicated copy. Server-only (fs), so this
// file must only be imported from Server Components / Route Handlers.
// See scripts/shareables/README.md for the manifest schema and
// scripts/shareables/build_manifest.py for how it's generated.

export type ShareablesSfxCue = {
  timestamp_s: number | null;
  description: string;
};

export type ShareablesClip = {
  id: number;
  slug: string;
  occasion: string;
  category: string;
  source_tag: string;
  raw_duration_s: number;
  caption: string;
  scene: string;
  kling_prompt: string;
  post_production_notes: string | null;
  alignment_note: string | null;
  sfx_cues: ShareablesSfxCue[];
  loop_trim: { in_s: number; out_s: number; status: string };
  assets: {
    raw_input: string;
    sfx_dir: string;
    public_output: string;
  };
};

export type ShareablesManifest = {
  generated_from: string;
  generated_note: string;
  global: {
    output_spec: {
      format: string;
      codec: string;
      width: number;
      height: number;
      loop_duration_s_min: number;
      loop_duration_s_max: number;
      max_size_mb: number;
      fps: number;
    };
    caption: { position: string; style: string };
    watermark: { position: string; opacity: number; opacity_range_note: string };
  };
  clips: ShareablesClip[];
};

let cached: ShareablesManifest | null = null;

export function getShareablesManifest(): ShareablesManifest {
  if (cached) return cached;
  const manifestPath = path.join(process.cwd(), 'scripts', 'shareables', 'manifest.json');
  const raw = fs.readFileSync(manifestPath, 'utf-8');
  cached = JSON.parse(raw) as ShareablesManifest;
  return cached;
}

/** Public download URL for a clip — served from Netlify static (Next.js
 * `public/` convention, confirmed as this site's only static-asset
 * pattern; no Supabase Storage usage exists anywhere in this codebase). */
export function shareablesPublicUrl(clip: ShareablesClip): string {
  // assets.public_output is repo-relative ("public/shareables/x.mp4");
  // the served URL drops the leading "public".
  return '/' + clip.assets.public_output.replace(/^public\//, '');
}
