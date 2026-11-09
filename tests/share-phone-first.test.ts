// Order 1510 item 2(b), decision 21a: on phones the phone's own share sheet comes first; otherwise the channel list.
// The share switch stays off (shareEnabled). Approved visible text is unchanged.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { shouldUseNativeShare, SHARE_TEXT, shareEnabled } from '../src/lib/share';

const root = join(__dirname, '..');
const control = readFileSync(join(root, 'src/components/share/ShareControl.tsx'), 'utf8');

describe('phone share sheet first (21a)', () => {
  it('uses the phone share sheet only with a share sheet and a touch pointer', () => {
    expect(shouldUseNativeShare({ canShare: true, coarsePointer: true })).toBe(true);
    expect(shouldUseNativeShare({ canShare: true, coarsePointer: false })).toBe(false);
    expect(shouldUseNativeShare({ canShare: false, coarsePointer: true })).toBe(false);
    expect(shouldUseNativeShare({ canShare: false, coarsePointer: false })).toBe(false);
  });
  it('the button calls the handler that tries the share sheet first', () => {
    expect(control).toMatch(/onClick=\{onPress\}/);
    expect(control).toMatch(/await navigator\.share\(\{ title: target\.title, url \}\)/);
  });
  it('falls back to the channel list when the share sheet is unavailable or cancelled', () => {
    expect(control).toMatch(/catch \{[\s\S]*?\}\s*\}\s*setOpen\(true\);/);
  });
  it('the switch stays off by default', () => {
    expect(shareEnabled({ shareEnabled: false })).toBe(false);
  });
});

describe('approved visible text is unchanged', () => {
  it('button and sheet lines', () => {
    expect(SHARE_TEXT.button).toBe('Time to blow your trumpet');
    expect(SHARE_TEXT.sheetTitle).toBe('Pick where to send it.');
    expect(SHARE_TEXT.previewCaption).toBe('Can you feel it');
    expect(SHARE_TEXT.copied).toBe('Awesomeness is loading');
    expect(SHARE_TEXT.collectionShared).toBe('Your list, shared. Take a bow');
  });
});
