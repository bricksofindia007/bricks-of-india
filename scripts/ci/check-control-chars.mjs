#!/usr/bin/env node
// P11 item 5: fail on control characters in tracked text files (scripts, SQL, config, docs).
//
// Why: twice (#236/#245 and 29 Sep) an edit made through a shell heredoc turned a regex
// word boundary `\b` into a literal backspace byte (0x08) and `\1` into 0x01. The code
// still parsed; the regex silently stopped matching. A backspace or similar byte is never
// intended in this repo's text files.
//
// Flags bytes 0x00-0x08, 0x0B, 0x0C, 0x0E-0x1F and 0x7F (tab, LF and CR are allowed) in every
// tracked file with a text extension. Prints file:line:column and the byte; exits 1 on any hit.
//   node scripts/ci/check-control-chars.mjs            (whole repo, tracked files)
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const TEXT = /\.(?:[cm]?[jt]sx?|py|sql|ya?ml|jsonc?|md|sh|ps1|toml|css|html|txt|env\.example)$/i;
const BAD = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  .split('\0').filter((f) => f && TEXT.test(f));

let hits = 0;
for (const f of files) {
  let s;
  try { s = readFileSync(f, 'utf8'); } catch { continue; }
  if (!BAD.test(s)) continue;
  BAD.lastIndex = 0;
  s.split('\n').forEach((line, i) => {
    for (const m of line.matchAll(BAD)) {
      hits++;
      const code = `0x${m[0].charCodeAt(0).toString(16).padStart(2, '0')}`;
      const ctx = line.slice(Math.max(0, m.index - 30), m.index + 30).replace(BAD, (c) => `<${c.charCodeAt(0).toString(16).padStart(2, '0')}>`);
      console.log(`::error file=${f},line=${i + 1},col=${m.index + 1}::control character ${code} in ${f}:${i + 1}:${m.index + 1}  ...${ctx}...`);
    }
  });
}
console.log(hits ? `FAIL: ${hits} control character(s)` : `PASS: no control characters in ${files.length} tracked text files`);
process.exit(hits ? 1 : 0);
