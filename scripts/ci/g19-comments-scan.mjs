#!/usr/bin/env node
// Read-only check of issue and pull-request comments on this repository.
// Output: a result file with counts, ids and urls only. The file is written to the output directory
// for upload as a run artifact.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const REPO = process.env.GITHUB_REPOSITORY;
const OUT = process.env.SCAN_OUT ?? 'g19-comments-scan';
const RAW = (process.env.G19_TERMS ?? '').replace(/^﻿/, '').trim();
if (!REPO) { console.log('scan: GITHUB_REPOSITORY not set. Stopping.'); process.exit(1); }
if (!RAW) { console.log('scan: settings are not available. Stopping.'); process.exit(1); }

const cfg = JSON.parse(RAW);
const APPROVED = new Set(JSON.parse(fs.readFileSync(path.join(process.cwd(), 'scripts/ci/g19-approved-public-sentences.json'), 'utf8')).map((e) => e.text));
const TERMS = Object.entries(cfg.terms).flatMap(([cat, pats]) => pats.map((p) => new RegExp(p, 'i')));
const ALLOW = cfg.allow.map((p) => new RegExp(p, 'gi'));

function hasTerm(text) {
  if (APPROVED.has(text.replace(/\s+/g, ' ').trim())) return false;
  for (const raw of text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean)) {
    const s = ALLOW.reduce((acc, re) => acc.replace(re, ' '), raw);
    for (const re of TERMS) if (re.test(s)) return true;
  }
  return false;
}

function listAll(endpoint) {
  // One page at a time: gh --paginate joins pages without separators, so it is not parsed as one stream.
  const all = [];
  for (let page = 1; page < 10000; page += 1) {
    const sep = endpoint.includes('?') ? '&' : '?';
    const out = execFileSync('gh', ['api', `${endpoint}${sep}page=${page}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const rows = JSON.parse(out || '[]');
    all.push(...rows);
    if (rows.length < 100) break;
  }
  return all;
}

const sources = [`repos/${REPO}/issues/comments?per_page=100`, `repos/${REPO}/pulls/comments?per_page=100`];
const flagged = [];
let scanned = 0;
for (const ep of sources) {
  for (const c of listAll(ep)) {
    scanned += 1;
    if (hasTerm(c.body ?? '')) flagged.push({ id: c.id, url: c.html_url });
  }
}

fs.mkdirSync(OUT, { recursive: true });
const lines = [
  `scanned_comments ${scanned}`,
  `flagged_comments ${flagged.length}`,
  ...flagged.map((f) => `${f.id} ${f.url}`),
];
fs.writeFileSync(path.join(OUT, 'result.txt'), lines.join('\n') + '\n', 'utf8');
console.log(`scan: scanned ${scanned}, flagged ${flagged.length} (ids and urls in the run artifact)`);
