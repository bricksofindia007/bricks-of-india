#!/usr/bin/env node
// G19 (CLAUDE.md, 1 Oct 2026): fail CI if public text reveals how Bricks of India works.
// Scans (1) public text files served as-is (robots.txt must be rules only; llms.txt, manifests,
// the brand guide) and (2) the user-visible strings in site code: JSX text, and string/template
// literals in pages, components and the lib modules that build page text, meta and JSON-LD.
// Comments, imports, class names, URLs, console/throw messages and admin/API code are skipped.
// Term list + allowed phrases: config/g19-terms.json (shared with the article lint gate).
// Published article/review bodies live in the database and are covered by the lint gate on new
// drafts; the live crawl (scripts/ci/g19-crawl.mjs) covers what's already published.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/g19-terms.json'), 'utf8'));
const TERMS = Object.entries(cfg.terms).flatMap(([cat, pats]) => pats.map((p) => [cat, new RegExp(p, 'i')]));
const ALLOW = cfg.allow.map((p) => new RegExp(p, 'gi'));

export function hits(text) {
  const out = [];
  for (const raw of text.split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean)) {
    const s = ALLOW.reduce((acc, re) => acc.replace(re, ' '), raw);
    for (const [cat, re] of TERMS) { const m = re.exec(s); if (m) { out.push({ cat, term: m[0], text: raw.slice(0, 160) }); break; } }
  }
  return out;
}

const PUBLIC_TEXT = ['public/llms.txt', 'public/site.webmanifest', 'public/brand/guide.html'];
const LIB_PUBLIC = ['src/lib/utils.ts', 'src/lib/lab-tools.ts', 'src/lib/price-summary.ts', 'src/lib/review-disclaimer.ts',
  'src/lib/brand.ts', 'src/lib/affiliate-disclosure.ts', 'src/lib/metadata.ts', 'src/lib/json-ld.ts', 'src/lib/jsonld.ts'];
const SKIP_DIRS = ['src/app/admin', 'src/app/api', 'src/app/actions'];

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name).replace(/\\/g, '/');
    if (e.isDirectory()) { if (!SKIP_DIRS.some((d) => p.startsWith(d))) walk(p, acc); }
    else if (/\.(tsx|ts)$/.test(e.name) && !/\.test\./.test(e.name)) acc.push(p);
  }
  return acc;
}

const SKIP_LINE = /^\s*(\/\/|\*|\/\*|import\s|export\s+\*|console\.|throw\s|super\(|.*\bclassName=)/;

// Constants whose VALUE is public text: inline them before scanning (src/lib/price-freshness.ts).
const CONSTS = { PRICE_CADENCE: 'every 6 hours' };
function inlineConsts(src) {
  let out = src;
  for (const [k, v] of Object.entries(CONSTS)) {
    out = out
      .split(`{${k}}`).join(v)                // JSX {PRICE_CADENCE}
      .split('${' + k + '}').join(v)          // template ${PRICE_CADENCE}
      .replace(new RegExp(`' \\+ ${k} \\+ '`, 'g'), v)
      .replace(new RegExp(`" \\+ ${k} \\+ "`, 'g'), v)
      .replace(new RegExp(`' \\+ ${k}\\b`, 'g'), ` ${v}'`)
      .replace(new RegExp(`\\b${k} \\+ '`, 'g'), `'${v} `);
  }
  return out;
}

function visibleStrings(src) {
  const out = [];
  const noBlock = inlineConsts(src).replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  noBlock.split('\n').forEach((line, i) => {
    if (SKIP_LINE.test(line)) return;
    const l = line.replace(/\/\/.*$/, '');
    for (const m of l.matchAll(/'((?:[^'\\]|\\.){6,})'|"((?:[^"\\]|\\.){6,})"|`((?:[^`\\]|\\.){6,})`/g)) {
      const v = (m[1] ?? m[2] ?? m[3]).replace(/\$\{[^}]*\}/g, ' ');
      if (/^(https?:|\/|@\/|\.\/|\[[\w-]+\]|[a-z0-9_.-]+$)/i.test(v) || !/\s/.test(v)) continue; // paths, ids, log tags, single tokens
      out.push([i + 1, v]);
    }
    // JSX text: any run between a tag/brace boundary and the next one, plus plain-text JSX lines.
    for (const m of l.matchAll(/[>}]([^<>{}]*[A-Za-z][^<>{}]{4,})(?=[<{]|$)/g)) {
      if (/^\s*(=|\.|\(|;|:|\?|&&|\|\||await\b|const\b|let\b|return\b)|=>|\s=\s|\.\w+\(/.test(m[1])) continue; // code, not text
      out.push([i + 1, m[1]]);
    }
    const t = l.trim();
    if (t && !/[=;(){}<>]|^[\w.]+:\s|^(return|await|const|let|\?|:|&&|\|\||\.)/.test(t) && !/\bawait\b/.test(t) && t.split(/\s+/).length >= 3) out.push([i + 1, t]);
  });
  return out;
}

const findings = [];
// (1) public files
const robots = fs.readFileSync('public/robots.txt', 'utf8').split('\n');
robots.forEach((l, i) => { if (/^\s*#/.test(l) || /\s#/.test(l)) findings.push({ file: 'public/robots.txt', line: i + 1, cat: 'robots-comment', term: '#', text: l.trim().slice(0, 160) }); });
for (const f of PUBLIC_TEXT) {
  if (!fs.existsSync(f)) continue;
  let t = fs.readFileSync(f, 'utf8');
  if (f.endsWith('.html')) t = t.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, '\n');
  t.split('\n').forEach((l, i) => { for (const h of hits(l)) findings.push({ file: f, line: i + 1, ...h }); });
}
// (2) site code
const files = [...walk('src/app'), ...walk('src/components'), ...LIB_PUBLIC.filter((f) => fs.existsSync(f))];
for (const f of [...new Set(files)]) {
  for (const [line, text] of visibleStrings(fs.readFileSync(f, 'utf8'))) for (const h of hits(text)) findings.push({ file: f, line, ...h });
}

if (process.env.G19_JSON) fs.writeFileSync(process.env.G19_JSON, JSON.stringify(findings, null, 1));
for (const x of findings) console.log(`${x.file}:${x.line} [${x.cat}: ${x.term}] ${x.text}`);
console.log(`\nG19 public-text check: ${findings.length} finding(s) in ${new Set(findings.map((x) => x.file)).size} file(s).`);
if (findings.length) {
  console.log('Fix the wording (CLAUDE.md G19). Allowed: "Updated X ago" and the /bot contact line. Term list: config/g19-terms.json.');
  process.exit(1);
}
