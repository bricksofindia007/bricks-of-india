// YouTube, Instagram and "Meet the founder" link tags. Off by default, mirrored in both flag files,
// and each tag sits on the agreed link with the agreed location. Nothing else is tagged.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';
import { sanitizeParams, trackEvent, LINK_LOCATIONS } from '../src/lib/analytics';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('keyEvents flag', () => {
  it('is off', () => {
    expect(FEATURE_FLAGS.keyEvents).toBe(false);
  });
  it('the Python flag file agrees (off)', () => {
    expect(read('config/feature_flags.py')).toMatch(/"key_events": False/);
  });
});

describe('allow-list', () => {
  it('allows the three link events with their parameters', () => {
    expect(sanitizeParams('click_youtube', { page_type: 'home', location: 'footer_connect', extra: 1 }))
      .toEqual({ page_type: 'home', location: 'footer_connect' });
    expect(sanitizeParams('click_instagram', { location: 'about_hero' })).toEqual({ location: 'about_hero' });
    expect(sanitizeParams('click_meet_founder', { page_type: 'precision', location: 'x' })).toEqual({ page_type: 'precision' });
  });
  it('the location list is exactly the seven agreed tags plus the top-bar logo tag (decision D-2026-10-29-01)', () => {
    expect([...LINK_LOCATIONS]).toEqual([
      'footer_connect', 'home_instagram_block', 'home_video_section', 'about_hero',
      'about_find_me', 'contact_social', 'video_strip', 'nav_logo',
    ]);
  });
  it('rejects a location outside the list', () => {
    expect(sanitizeParams('click_youtube', { location: 'nav_about' })).toEqual({});
  });
});

describe('trackEvent gate', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it('sends nothing for the YouTube and Instagram link events while the flag is off', () => {
    const gtag = vi.fn();
    (globalThis as { window?: unknown }).window = { gtag };
    trackEvent('click_youtube', { location: 'footer_connect' });
    trackEvent('click_instagram', { location: 'about_hero' });
    expect(gtag).not.toHaveBeenCalled();
  });

  it('records every Meet the founder click while the flag is off (owner decision, 27 Oct 11:19)', () => {
    const gtag = vi.fn();
    (globalThis as { window?: unknown }).window = { gtag };
    trackEvent('click_meet_founder', { page_type: 'precision' });
    expect(gtag).toHaveBeenCalledWith('event', 'click_meet_founder', { page_type: 'precision' });
  });

  it('sends the link events once the flag is on', () => {
    const gtag = vi.fn();
    (globalThis as { window?: unknown }).window = { gtag };
    const flags = FEATURE_FLAGS as { keyEvents: boolean };
    flags.keyEvents = true;
    try {
      trackEvent('click_youtube', { location: 'footer_connect' });
      expect(gtag).toHaveBeenCalledWith('event', 'click_youtube', { location: 'footer_connect' });
    } finally {
      flags.keyEvents = false;
    }
  });
});

// Each tag: the file, the event, and the location, all on the same element.
const PLACEMENTS: Array<[string, string, string]> = [
  ['src/components/layout/Footer.tsx', 'click_youtube', 'footer_connect'],
  ['src/components/layout/Footer.tsx', 'click_instagram', 'footer_connect'],
  ['src/app/page.tsx', 'click_instagram', 'home_instagram_block'],
  ['src/components/ui/YouTubeSection.tsx', 'click_youtube', 'home_video_section'],
  ['src/app/about/page.tsx', 'click_youtube', 'about_hero'],
  ['src/app/about/page.tsx', 'click_instagram', 'about_hero'],
  ['src/app/about/page.tsx', 'click_youtube', 'about_find_me'],
  ['src/app/about/page.tsx', 'click_instagram', 'about_find_me'],
  ['src/app/contact/page.tsx', 'click_youtube', 'contact_social'],
  ['src/app/contact/page.tsx', 'click_instagram', 'contact_social'],
  ['src/components/content/YoutubeStrip.tsx', 'click_youtube', 'video_strip'],
];

describe('placements carry the agreed tag', () => {
  for (const [file, event, location] of PLACEMENTS) {
    it(`${file}: ${event} / ${location}`, () => {
      const src = read(file);
      const re = new RegExp(`event="${event}"\\s+params=\\{\\{ location: '${location}' \\}\\}`);
      expect(src).toMatch(re);
    });
  }
  it('the precision page tags only the Meet the founder link', () => {
    const src = read('src/app/precision/page.tsx');
    expect(src).toMatch(/<MeetFounderLink href="\/about"/);
    expect(src).not.toMatch(/location: /);
    expect(read('src/app/precision/MeetFounderLink.tsx')).toMatch(/trackEvent\('click_meet_founder', \{ page_type: 'precision' \}\)/);
  });
});

describe('not built (placements 12 to 14 and our website)', () => {
  it('no nav, company-footer or byline tag', () => {
    expect(read('src/components/layout/Footer.tsx')).not.toMatch(/footer_company_about|nav_about|byline_about/);
    for (const f of ['src/components/layout/Navbar.tsx', 'src/app/reviews/[slug]/page.tsx']) {
      expect(read(f)).not.toMatch(/click_youtube|click_instagram|click_meet_founder/);
    }
  });
  it('no event for our own website', () => {
    expect(read('src/lib/analytics.ts')).not.toMatch(/click_(our_)?website/);
  });
});
