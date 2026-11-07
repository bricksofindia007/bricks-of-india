import { describe, it, expect } from 'vitest';
import { readFileSync, mkdtempSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { parse as parseYaml } from 'yaml';

// Staging-only fixture row for daily story 78. The script is run for real against a stub psql that records the SQL
// it would send; no database is touched.
const root = join(__dirname, '..');
const script = join(root, 'scripts/ci/seed-staging-video-story78.sh');
const STAGING_URL = 'postgres://seed@db.example/vdixqwjiiifliepzufpc';
const PROD_URL = 'postgres://seed@db.example/hqpaiarhmiocmjrzjhtw';

function run(mode: string, url: string) {
  const dir = mkdtempSync(join(tmpdir(), 'seed78-'));
  const recorded = join(dir, 'sql.txt');
  const stub = join(dir, 'psql-stub.sh');
  writeFileSync(stub, '#!/usr/bin/env bash\ncat >> "$STUB_OUT"\necho 0\n');
  const res = spawnSync('bash', [script, mode], {
    env: { ...process.env, STAGING_DB_URL: url, PSQL: `bash ${stub.replace(/\\/g, '/')}`, STUB_OUT: recorded },
    encoding: 'utf8',
  });
  const sql = existsSync(recorded) ? readFileSync(recorded, 'utf8') : '';
  return { status: res.status, out: `${res.stdout}${res.stderr}`, sql };
}

describe('staging-only story 78 fixture (order 1010)', () => {
  it('refuses the production project and writes nothing', () => {
    const r = run('seed', PROD_URL);
    expect(r.status).not.toBe(0);
    expect(r.out).toContain('REFUSED: the connection is the production project');
    expect(r.sql).toBe('');
  });

  it('refuses any connection that is not the staging project', () => {
    const r = run('seed', 'postgres://seed@db.example/some-other-project');
    expect(r.status).not.toBe(0);
    expect(r.out).toContain('REFUSED: the connection is not the staging project');
    expect(r.sql).toBe('');
  });

  it('refuses a mode other than seed or remove', () => {
    const r = run('drop', STAGING_URL);
    expect(r.status).not.toBe(0);
    expect(r.sql).toBe('');
  });

  it('seed inserts exactly one row: fixed id, story 78, set 76269, status publish_blocked, and no delete', () => {
    const r = run('seed', STAGING_URL);
    expect(r.status).toBe(0);
    expect(r.sql).toContain('insert into public.video_posts');
    expect(r.sql).toContain("'a0000000-0000-4000-8000-000000000078'");
    expect(r.sql).toMatch(/'publish_blocked', 78\)/);
    expect(r.sql).toContain("'76269'");
    expect(r.sql).toContain('expected exactly one seeded row after the seed');
    expect(r.sql.toLowerCase()).not.toContain('delete from');
    expect(r.sql).toMatch(/^begin;/m);
    expect(r.sql).toMatch(/^commit;/m);
  });

  it('remove deletes only the fixture row, guarded by its markers, and inserts nothing', () => {
    const r = run('remove', STAGING_URL);
    expect(r.status).toBe(0);
    expect(r.sql).toContain("delete from public.video_posts where id = 'a0000000-0000-4000-8000-000000000078' and script = 'staging seed' and video_path = 'staging seed';");
    expect(r.sql.toLowerCase()).not.toContain('insert into');
    expect(r.sql).toMatch(/^commit;/m);
  });

  it('the workflow runs only from main, behind the staging-seed environment, with its confirmation text and a timeout', () => {
    const wf = parseYaml(readFileSync(join(root, '.github/workflows/staging-seed-video-story78.yml'), 'utf8'));
    const job = wf.jobs.seed;
    expect(job.environment).toBe('staging-seed');
    expect(job['timeout-minutes']).toEqual(expect.any(Number));
    expect(job.if).toContain("github.ref == 'refs/heads/main'");
    expect(job.if).toContain("'SEED STAGING STORY 78 AND REWORK ROW'");
    expect(job.if).toContain("'REMOVE STAGING STORY 78 AND REWORK ROW'");
  });

  it('seed also inserts the Snowman rework row and its parent, both marked as fixtures, child after parent', () => {
    const r = run('seed', STAGING_URL);
    expect(r.status).toBe(0);
    expect(r.sql).toContain("'c4af5037-27f9-40db-ab03-1825cb5f888b'");
    expect(r.sql).toContain("'660c4b8f-9278-404e-9343-da305ec01769'");
    expect(r.sql).toContain('insert into public.quiet_panic_posts');
    expect(r.sql).toMatch(/'pending_approval', '660c4b8f-9278-404e-9343-da305ec01769'\);/);
    expect(r.sql).toContain('expected exactly one seeded rework row after the seed');
    expect(r.sql.indexOf("'660c4b8f-9278-404e-9343-da305ec01769', 'Snowman Ornaments'")).toBeLessThan(
      r.sql.indexOf("'c4af5037-27f9-40db-ab03-1825cb5f888b', 'Snowman Ornaments'"));
    expect(r.sql.toLowerCase()).not.toContain('delete from');
  });

  it('remove deletes the rework row first, then its parent, both guarded by the fixture markers, and checks the count of two', () => {
    const r = run('remove', STAGING_URL);
    expect(r.status).toBe(0);
    const child = "delete from public.quiet_panic_posts where id = 'c4af5037-27f9-40db-ab03-1825cb5f888b' and script = 'staging seed' and video_path = 'staging seed';";
    const parent = "delete from public.quiet_panic_posts where id = '660c4b8f-9278-404e-9343-da305ec01769' and script = 'staging seed' and video_path = 'staging seed';";
    expect(r.sql).toContain(child);
    expect(r.sql).toContain(parent);
    expect(r.sql.indexOf(child)).toBeLessThan(r.sql.indexOf(parent));
    expect(r.sql).toContain('expected exactly two rework fixture rows to remove');
    expect(r.sql.toLowerCase()).not.toContain('insert into');
  });

  it('the story 78 statements are the same text as before the Snowman extension', () => {
    const r = run('seed', STAGING_URL);
    expect(r.sql).toContain("values\n  ('a0000000-0000-4000-8000-000000000078', 'Avengers Tower', '76269', 'mybrickhouse'");
    expect(r.sql).toContain("'staging seed', 0, '{}'::jsonb, 'staging seed', 'publish_blocked', 78);");
  });

  it('fix 911 approves only the one rework row, names its parent, and has the expect lines and a backup line', () => {
    const fix = readFileSync(join(root, 'supabase/data-fixes/911-quiet-panic-snowman-rework-approve.sql'), 'utf8');
    expect(fix).toContain('-- boi:issue 911');
    expect(fix).toContain('-- boi:backup-tables public.quiet_panic_posts');
    expect(fix).toContain("-- boi:expect-before select count(*) from public.quiet_panic_posts where id = 'c4af5037-27f9-40db-ab03-1825cb5f888b' and status = 'pending_approval' and reworked_from = '660c4b8f-9278-404e-9343-da305ec01769' = 1");
    expect(fix).toContain("-- boi:expect-after select count(*) from public.quiet_panic_posts where id = 'c4af5037-27f9-40db-ab03-1825cb5f888b' and status = 'approved' = 1");
    const updates = fix.split('\n').filter((l) => /^update /i.test(l));
    expect(updates).toHaveLength(1);
    expect(updates[0]).toContain("where id = 'c4af5037-27f9-40db-ab03-1825cb5f888b'");
    expect(updates[0]).toContain("reworked_from = '660c4b8f-9278-404e-9343-da305ec01769'");
  });

  it('the workflow file is listed as a user of the staging database secret in the secrets manifest', () => {
    const manifest = JSON.parse(readFileSync(join(root, '.github/secrets-manifest.json'), 'utf8'));
    expect(manifest.STAGING_DB_URL.required_by).toContain('staging-seed-video-story78.yml');
  });
});
