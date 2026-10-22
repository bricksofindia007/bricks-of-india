#!/usr/bin/env node
// Attribution check for public text (queue item 13, 22 Oct 2026): fails if a pull request's title or body, or a
// commit message in the pull request, carries an AI attribution line. Output names the commit or the field only,
// never the matched text (CI logs are public).
// Usage in CI: node scripts/ci/pr-text-check.mjs   (reads GITHUB_EVENT_PATH and the base..head commit range)
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const PATTERNS = [
  /co-authored-by:\s*claude/i,
  /generated with\s*\[?claude/i,
  /noreply@anthropic\.com/i,
  /claude code\b.*\bgenerated/i,
];

/** Pure: true when one piece of text carries an attribution line. */
export function hasAttribution(text) {
  return PATTERNS.some((p) => p.test(text ?? ''));
}

/** Pure: the list of names (field or commit) whose text carries an attribution line. */
export function attributionHits(items) {
  return items.filter((it) => hasAttribution(it.text)).map((it) => it.name);
}

function main() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) {
    console.log('pr-text-check: not a pull request event; nothing to check.');
    return 0;
  }
  const pr = JSON.parse(fs.readFileSync(eventPath, 'utf8')).pull_request;
  if (!pr) { console.log('pr-text-check: no pull_request in event; nothing to check.'); return 0; }
  const items = [
    { name: 'pull request title', text: pr.title },
    { name: 'pull request body', text: pr.body },
  ];
  const range = `${pr.base.sha}..${pr.head.sha}`;
  const shas = execFileSync('git', ['rev-list', range], { encoding: 'utf8' }).split('\n').filter(Boolean);
  for (const sha of shas) {
    const msg = execFileSync('git', ['log', '-1', '--format=%B', sha], { encoding: 'utf8' });
    items.push({ name: `commit ${sha.slice(0, 10)}`, text: msg });
  }
  const hits = attributionHits(items);
  if (hits.length) {
    console.log(`pr-text-check: attribution line found in: ${hits.join(', ')}. Remove it and push again.`);
    return 1;
  }
  console.log(`pr-text-check: ${items.length} text item(s) checked; none carries an attribution line.`);
  return 0;
}

if (process.argv[1] && process.argv[1].endsWith('pr-text-check.mjs')) {
  process.exitCode = main();
}
