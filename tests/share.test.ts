// Share control: registration, flag mirror, channel links, closed analytics parameters, and content rules.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LAB_TOOLS } from '../src/lib/lab-tools';
import {
  SHARE_TARGETS, SHARE_TARGET_IDS, SHARE_TEXT, channelLink, shareEnabled, targetForPath,
} from '../src/lib/share';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';
import { sanitizeParams } from '../src/lib/analytics';

const root = join(__dirname, '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
const SHARE_FILES = [
  'src/lib/share.ts',
  'src/components/share/ShareControl.tsx',
  'src/components/share/ShareMount.tsx',
];

describe('flag mirror', () => {
  it('shareEnabled is off in TypeScript and in the Python mirror', () => {
    expect(FEATURE_FLAGS.shareEnabled).toBe(false);
    expect(read('config/feature_flags.py')).toMatch(/"share_enabled":\s*False/);
  });
  it('shareEnabled() is false unless exactly true', () => {
    expect(shareEnabled({ shareEnabled: false })).toBe(false);
    expect(shareEnabled({ shareEnabled: true })).toBe(true);
  });
});

describe('registration', () => {
  it('every Lab tool in lab-tools.ts carries share settings', () => {
    for (const tool of LAB_TOOLS) {
      expect(tool.share, `missing share settings on ${tool.id}`).toBeDefined();
      expect(tool.share.mode).toBe('page_link');
    }
  });
  it('registers the live Lab tools and Minifig HQ, and nothing else', () => {
    expect(SHARE_TARGET_IDS).toEqual(expect.arrayContaining(['biryani-index', 'which-set-are-you', 'minifig-hq']));
    expect(SHARE_TARGET_IDS).not.toContain('community');
    expect(SHARE_TARGET_IDS).not.toContain('the-brick-portfolio');
    expect(targetForPath('/lab')).toBeNull();
    expect(targetForPath('/lab/cmf-tracker')).toBeNull();
  });
  it('finds a target by its page path, with or without a trailing slash', () => {
    expect(targetForPath('/minifig-hq')?.id).toBe('minifig-hq');
    expect(targetForPath('/lab/biryani-index/')?.id).toBe('biryani-index');
  });
});

describe('channel links', () => {
  const url = 'https://bricksofindia.com/lab/biryani-index';
  it('WhatsApp uses wa.me with the title and link', () => {
    expect(channelLink('whatsapp', 'The Biryani Index', url)).toBe(
      `https://wa.me/?text=${encodeURIComponent(`The Biryani Index ${url}`)}`,
    );
  });
  it('Facebook uses the sharer link with the page link', () => {
    expect(channelLink('facebook', 'T', url)).toBe(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`);
  });
  it('Email uses mailto with the visitor\'s own mail app; the site sends nothing', () => {
    expect(channelLink('email', 'T', url)).toMatch(/^mailto:\?subject=T&body=/);
  });
  it('Instagram and copy have no link form', () => {
    expect(channelLink('instagram', 'T', url)).toBeNull();
    expect(channelLink('copy', 'T', url)).toBeNull();
  });
});

describe('approved visible text', () => {
  it('uses the owner-approved strings exactly', () => {
    expect(SHARE_TEXT.button).toBe('Time to blow your trumpet');
    expect(SHARE_TEXT.sheetTitle).toBe('Pick where to send it.');
    expect(SHARE_TEXT.previewCaption).toBe('Can you feel it');
    expect(SHARE_TEXT.copied).toBe('Awesomeness is loading');
    expect(SHARE_TEXT.instagramFallback).toBe('Save the card, add it to your story. Time to make the world jealous');
    expect(SHARE_TEXT.failureNoApp).toBe('Nothing opened. Copy the link and send it yourself.');
    expect(SHARE_TEXT.failureGeneral).toBe('That did not go through. Your list is still safe. Try again, or copy the link.');
  });
});

describe('content rules', () => {
  it('no AI call in any share file', () => {
    for (const f of SHARE_FILES) {
      expect(read(f), f).not.toMatch(/gemini|openai|groq|cerebras|anthropic|generateContent/i);
    }
  });
  it('no rupee value in any share file', () => {
    for (const f of SHARE_FILES) {
      expect(read(f), f).not.toMatch(/₹|\bINR\b|Rs\.?\s?\d/);
    }
  });
  it('shares the title and link only: no name, email or account detail', () => {
    for (const f of SHARE_FILES) {
      expect(read(f), f).not.toMatch(/localStorage|sessionStorage|document\.cookie|boi_wishlist|boi_guest_collection|user\.email|\.account/i);
    }
  });
  it('registered targets have a title and a page path', () => {
    for (const t of SHARE_TARGETS) {
      expect(t.title.length).toBeGreaterThan(0);
      expect(t.path.startsWith('/')).toBe(true);
    }
  });
});

describe('click_share analytics parameters', () => {
  it('keeps registered tools and the five channels', () => {
    expect(sanitizeParams('click_share', { page_type: 'lab', tool: 'biryani-index', channel: 'whatsapp' }))
      .toEqual({ page_type: 'lab', tool: 'biryani-index', channel: 'whatsapp' });
  });
  it('drops an unregistered tool or an unknown channel', () => {
    expect(sanitizeParams('click_share', { page_type: 'lab', tool: 'not-a-tool', channel: 'sms' })).toEqual({ page_type: 'lab' });
  });
});
