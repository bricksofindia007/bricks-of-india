// Top-bar logo or home link: one key event (order 0130, decision D-2026-10-29-01), behind the keyEvents flag (off).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';
import { sanitizeParams, trackEvent, LINK_LOCATIONS } from '../src/lib/analytics';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

describe('the event and its tag', () => {
  it('click_logo carries only the location, and the location is nav_logo', () => {
    expect(sanitizeParams('click_logo', { location: 'nav_logo', page_type: 'home' })).toEqual({ location: 'nav_logo' });
    expect((LINK_LOCATIONS as readonly string[]).includes('nav_logo')).toBe(true);
  });
  it('the logo link in the navbar carries the tag exactly once', () => {
    const src = read('src/components/layout/Navbar.tsx');
    expect(src.match(/trackEvent\('click_logo', \{ location: 'nav_logo' \}\)/g)?.length).toBe(1);
  });
  it('no other file uses the event or the tag', () => {
    const others = ['src/components/layout/Footer.tsx', 'src/app/page.tsx', 'src/app/about/page.tsx', 'src/app/contact/page.tsx', 'src/components/content/YoutubeStrip.tsx', 'src/components/ui/YouTubeSection.tsx', 'src/app/precision/page.tsx', 'src/app/precision/MeetFounderLink.tsx', 'src/app/precision/PrecisionCta.tsx'];
    for (const f of others) expect(read(f)).not.toMatch(/click_logo|nav_logo/);
  });
  it('placements 12 to 14 stay not built', () => {
    const all = ['src/components/layout/Navbar.tsx', 'src/components/layout/Footer.tsx', 'src/lib/analytics.ts'];
    for (const f of all) expect(read(f)).not.toMatch(/nav_about|footer_company_about|byline_about/);
  });
});

describe('the gate', () => {
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });
  it('is off in the flag file', () => {
    expect(FEATURE_FLAGS.keyEvents).toBe(false);
    expect(read('config/feature_flags.py')).toMatch(/"key_events": False/);
  });
  it('sends nothing while the flag is off', () => {
    const gtag = vi.fn();
    (globalThis as { window?: unknown }).window = { gtag };
    trackEvent('click_logo', { location: 'nav_logo' });
    expect(gtag).not.toHaveBeenCalled();
  });
  it('sends the event with the exact name and location once the flag is on', () => {
    const gtag = vi.fn();
    (globalThis as { window?: unknown }).window = { gtag };
    const flags = FEATURE_FLAGS as { keyEvents: boolean };
    flags.keyEvents = true;
    try {
      trackEvent('click_logo', { location: 'nav_logo' });
      expect(gtag).toHaveBeenCalledWith('event', 'click_logo', { location: 'nav_logo' });
    } finally {
      flags.keyEvents = false;
    }
  });
});

describe('the store links keep their own counting', () => {
  it('no new event is added for store links', () => {
    expect(read('src/lib/analytics.ts')).not.toMatch(/click_store_link|click_store_outbound/);
  });
});
