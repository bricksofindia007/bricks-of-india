#!/usr/bin/env node
// Heart-code check on a production-style build, plus page weight of the set page's JavaScript.
// With the my_collection_hearts flag off (the default), the set page must not load the heart code.
// Reads the build output only. Prints file names, byte counts and whether a marker is present; never page content.
//
//   node scripts/ci/heart-bundle-check.mjs [.next]
//
// Markers: the two heart voice lines. They are defined only in the heart code's voice constants.
// Exit 1 if any JavaScript file the set page loads contains a marker (the heart code is downloaded with the flag off).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const dir = process.argv[2] ?? '.next';
const MARKERS = ['Your wallet has been notified.', 'Your wallet is relieved.'];
const ROUTE = '/sets/[slug]/page';

const manifestPath = path.join(dir, 'app-build-manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.log(`heart check: ${manifestPath} not found; nothing checked`);
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const pageFiles = manifest.pages?.[ROUTE];
if (!Array.isArray(pageFiles)) {
  console.log(`heart check: route ${ROUTE} not in the build manifest; nothing checked`);
  process.exit(1);
}

let rawTotal = 0;
let gzTotal = 0;
const withMarker = [];
const jsFiles = pageFiles.filter((f) => f.endsWith('.js'));
for (const f of jsFiles) {
  const full = path.join(dir, f);
  if (!fs.existsSync(full)) continue;
  const buf = fs.readFileSync(full);
  rawTotal += buf.length;
  gzTotal += zlib.gzipSync(buf, { level: 9 }).length;
  const text = buf.toString('utf8');
  const hits = MARKERS.filter((m) => text.includes(m)).length;
  if (hits > 0) withMarker.push(`${f} (${hits} marker(s))`);
}

console.log(`set page loads ${jsFiles.length} JavaScript file(s): ${rawTotal} bytes raw, ${gzTotal} bytes gzipped`);
console.log(`heart check: ${withMarker.length} of those files contain a heart marker`);
for (const w of withMarker) console.log(`  heart code in a set page file: ${w}`);
process.exit(withMarker.length ? 1 : 0);
