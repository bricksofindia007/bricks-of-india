// Regional tag cache toggle: off by default (production unchanged); on only when a build sets TAG_REGIONAL_CACHE=1.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// open-next.config.ts is imported for its exported helper only.
import { tagCacheOptions } from '../open-next.config';

const root = join(__dirname, '..');

describe('regional tag cache toggle', () => {
  it('is off when the variable is absent (production options unchanged)', () => {
    expect(tagCacheOptions({})).toEqual({ baseShardSize: 12 });
  });

  it('is off for any value other than 1', () => {
    expect(tagCacheOptions({ TAG_REGIONAL_CACHE: '0' })).toEqual({ baseShardSize: 12 });
    expect(tagCacheOptions({ TAG_REGIONAL_CACHE: '' })).toEqual({ baseShardSize: 12 });
  });

  it('is on with a 60-second regional cache when the variable is 1', () => {
    expect(tagCacheOptions({ TAG_REGIONAL_CACHE: '1' })).toEqual({
      baseShardSize: 12,
      regionalCache: true,
      regionalCacheTtlSec: 60,
    });
  });

  it('the production deploy never sets the toggle', () => {
    expect(readFileSync(join(root, '.github/workflows/deploy-cloudflare.yml'), 'utf8')).not.toMatch(/TAG_REGIONAL_CACHE/);
  });

  it('the staging workflow exposes the toggle as a dispatch input, default off, and passes it to the build', () => {
    const wf = readFileSync(join(root, '.github/workflows/deploy-cloudflare-staging.yml'), 'utf8');
    expect(wf).toMatch(/regional_tag_cache:[\s\S]*default: '0'/);
    expect(wf).toMatch(/TAG_REGIONAL_CACHE: \$\{\{ inputs\.regional_tag_cache \}\}/);
  });
});
