// Instagram story card (order 1130, addendum 11:30 item 8). Flag off (shareEnabled). Instagram stays out of the visible
// channels until the owner approves the sample card.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cardCopy, drawShareCard, labCardCopy, labCardFileName, CARD_SIZES, type CardCanvas } from '../src/lib/share-card';
import { VISIBLE_CHANNELS, SHARE_TEXT } from '../src/lib/share';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

function recorder(): CardCanvas & { texts: string[] } {
  const texts: string[] = [];
  return {
    fillStyle: '',
    font: '',
    textAlign: 'start',
    fillRect() {},
    fillText(t: string) { texts.push(t); },
    texts,
  };
}

describe('the story card', () => {
  it('is the story size (1080 by 1920)', () => {
    expect(CARD_SIZES.story).toEqual({ width: 1080, height: 1920 });
  });
  it('the collection card is unchanged: heading, count, approved line, footer', () => {
    const ctx = recorder();
    drawShareCard(ctx, 'story', cardCopy('collection', 12));
    expect(ctx.texts).toEqual(['My Collection', '12 sets', SHARE_TEXT.collectionShared, 'bricksofindia.com']);
  });
  it('the Lab card shows only the tool name and the site name (no count, no line, no price)', () => {
    const ctx = recorder();
    drawShareCard(ctx, 'story', labCardCopy('Biryani Index'));
    expect(ctx.texts).toEqual(['Biryani Index', 'bricksofindia.com']);
    expect(labCardCopy('Biryani Index').line).toBe('');
  });
  it('the Lab card file name uses the tool id only', () => {
    expect(labCardFileName('biryani-index', 'story')).toBe('biryani-index-story.png');
  });
});

describe('the Instagram channel', () => {
  const share = read('src/components/share/ShareControl.tsx');
  it('shares the image where the phone can, otherwise downloads it and opens Instagram', () => {
    expect(share).toMatch(/navigator\.share\(\{ files: \[file\], title: target\.title \}\)/);
    expect(share).toMatch(/navigator\.canShare\?\.\(\{ files: \[file\] \}\)/);
    expect(share).toMatch(/a\.download = name;/);
    expect(share).toMatch(/window\.open\('https:\/\/www\.instagram\.com\/', '_blank'\)/);
  });
  it('a cancelled share is not reported as a failure', () => {
    expect(share).toMatch(/if \(\(err as Error\)\.name !== 'AbortError'\)/);
  });
  it('the site sends nothing itself (no upload, no fetch)', () => {
    expect(share).not.toMatch(/fetch\(|XMLHttpRequest|FormData/);
  });
  it('Instagram stays out of the visible channels until the owner approves the sample card', () => {
    expect(VISIBLE_CHANNELS).not.toContain('instagram');
  });
});
