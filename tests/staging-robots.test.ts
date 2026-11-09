// Order 0830: the staging build keeps every crawler out; the production robots.txt is unchanged.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

describe('robots on the staging build', () => {
  const staging = read('scripts/ci/robots-staging.txt');
  it('blocks every crawler and names no sitemap', () => {
    expect(staging).toBe('User-agent: *\nDisallow: /\n');
    expect(staging).not.toMatch(/sitemap/i);
    expect(staging).not.toMatch(/Allow:/);
  });
  it('the staging workflow copies it over public/robots.txt before the Next build, and nowhere else', () => {
    const wf = read('.github/workflows/deploy-cloudflare-staging.yml');
    const copyAt = wf.indexOf('cp scripts/ci/robots-staging.txt public/robots.txt');
    const buildAt = wf.indexOf('name: Next.js build');
    expect(copyAt).toBeGreaterThan(-1);
    expect(copyAt).toBeLessThan(buildAt);
    const prod = read('.github/workflows/deploy-cloudflare.yml');
    expect(prod).not.toMatch(/robots-staging/);
  });
});

describe('robots on the production build', () => {
  const prod = read('public/robots.txt');
  it('production robots.txt is the same as before: general crawlers allowed, sitemap listed', () => {
    expect(prod).toMatch(/User-agent: \*\nAllow: \//);
    expect(prod).toMatch(/Sitemap: https:\/\/bricksofindia\.com\/sitemap\.xml/);
    // Only the generic block: the AI training agents are disallowed from the whole site on purpose (owner order 17:54, 9 Nov 2026).
    const generic = prod.split(/\n\n+/).find((b) => b.startsWith('User-agent: *')) ?? '';
    expect(generic).not.toMatch(/^Disallow: \/$/m);
  });
  it('the production workflow does not copy the staging file', () => {
    expect(read('.github/workflows/deploy-cloudflare.yml')).not.toMatch(/robots-staging\.txt/);
  });
});

// Order 0850: the workflow must parse as YAML. An unquoted colon-space inside a step name broke the whole file once.
import { parse as parseYaml } from 'yaml';

describe('workflow files parse as YAML', () => {
  it('deploy-cloudflare-staging.yml parses, and the robots step is a named step with a run', () => {
    const wf = parseYaml(read('.github/workflows/deploy-cloudflare-staging.yml'));
    const steps: { name?: string; run?: string }[] = wf.jobs['deploy-staging'].steps;
    const robots = steps.find((s) => s.run === 'cp scripts/ci/robots-staging.txt public/robots.txt');
    expect(robots, 'robots step').toBeDefined();
    expect(robots!.name).toBe('Staging robots, keep crawlers out (staging build only)');
  });
  it('deploy-cloudflare.yml (production) parses and has no robots copy', () => {
    const wf = parseYaml(read('.github/workflows/deploy-cloudflare.yml'));
    expect(wf.jobs).toBeDefined();
    expect(JSON.stringify(wf)).not.toMatch(/robots-staging/);
  });
});
