// Convert docs/codex/BOI_Codex_v2.docx → docs/codex/BOI_Codex_v2.md
// Used because pandoc and python-docx are not available locally.
// Run: node scripts/export-codex-md.js
//
// Requires: unzip (available in Git Bash / MSYS2 / Linux / macOS)
// Prefer pandoc if installed — it produces richer output:
//   pandoc docs/codex/BOI_Codex_v2.docx -o docs/codex/BOI_Codex_v2.md

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const DOCX = path.join(__dirname, '..', 'docs', 'codex', 'BOI_Codex_v2.docx');
const OUT_MD = path.join(__dirname, '..', 'docs', 'codex', 'BOI_Codex_v2.md');
const EXTRACT_DIR = path.join(__dirname, '..', 'docs', 'codex', 'extract_tmp');

if (!fs.existsSync(DOCX)) {
  console.error('ERROR: docs/codex/BOI_Codex_v2.docx not found');
  process.exit(1);
}

// Extract word/document.xml from the docx zip
fs.mkdirSync(EXTRACT_DIR, { recursive: true });
execSync(`unzip -o "${DOCX}" "word/document.xml" -d "${EXTRACT_DIR}"`, { stdio: 'pipe' });

const xml = fs.readFileSync(path.join(EXTRACT_DIR, 'word', 'document.xml'), 'utf8');

// Parse paragraphs from Open XML, applying basic markdown heading styles
const paraMatches = xml.match(/<w:p[ >][\s\S]*?<\/w:p>/g) || [];
const paras = [];

for (const para of paraMatches) {
  const styleMatch = para.match(/<w:pStyle w:val="([^"]+)"/);
  const style = styleMatch ? styleMatch[1] : '';

  const textMatches = para.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || [];
  const text = textMatches
    .map((t) => t.replace(/<w:t[^>]*>/, '').replace(/<\/w:t>/, ''))
    .join('');

  if (!text.trim()) continue;

  if (/^Heading1$/i.test(style) || style === 'Title') {
    paras.push('# ' + text);
  } else if (/^Heading2$/i.test(style)) {
    paras.push('## ' + text);
  } else if (/^Heading3$/i.test(style)) {
    paras.push('### ' + text);
  } else {
    paras.push(text);
  }
}

const md = paras.join('\n\n');
fs.writeFileSync(OUT_MD, md, 'utf8');

// Clean up temp extraction
fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });

console.log(`Written: ${OUT_MD}`);
console.log(`Paragraphs: ${paras.length}`);
console.log(`Bytes: ${Buffer.byteLength(md, 'utf8')}`);
