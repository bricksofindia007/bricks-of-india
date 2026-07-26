/**
 * Secrets Manifest Audit — validates every workflow's env block against
 * .github/secrets-manifest.json. Exits 1 if any drift is found.
 *
 * Two checks:
 *   A. For every secret declared required_by a workflow, verify that workflow
 *      actually references it via secrets.<NAME>.
 *   B. For every secrets.<NAME> reference in any workflow, verify that specific
 *      workflow is listed in <NAME>'s required_by array -- not just that the
 *      secret name exists somewhere in the manifest. (Hardened 2026-07-26:
 *      the name-exists-anywhere version let a real reference silently go
 *      undocumented for a specific workflow -- e.g. RESEND_API_KEY added to
 *      ig-token-refresh.yml in a3a48d6 passed because RESEND_API_KEY was
 *      already declared for other workflows.)
 *
 * Run: node scripts/audit-secrets-manifest.mjs
 * Wired into: .github/workflows/code-audit.yml (Monday 05:00 UTC)
 */

import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const WF_DIR = join(ROOT, '.github', 'workflows');

// ── Load manifest ─────────────────────────────────────────────────────────────

const manifest = JSON.parse(
  readFileSync(join(ROOT, '.github', 'secrets-manifest.json'), 'utf-8'),
);

const AUTO_INJECTED = new Set(manifest._auto_injected ?? []);
const secrets = Object.fromEntries(
  Object.entries(manifest).filter(([k]) => !k.startsWith('_')),
);

// ── Load workflow files ───────────────────────────────────────────────────────

const wfFiles = readdirSync(WF_DIR)
  .filter(f => f.endsWith('.yml') && f !== 'secrets-manifest.yml');

function workflowSecrets(filename) {
  const text = readFileSync(join(WF_DIR, filename), 'utf-8');
  return new Set([...text.matchAll(/secrets\.([A-Z_]+)/g)].map(m => m[1]));
}

const wfSecretMap = Object.fromEntries(
  wfFiles.map(f => [f, workflowSecrets(f)]),
);

// ── Run checks ────────────────────────────────────────────────────────────────

let failures = 0;
const failLines = [];
const passLines = [];

function fail(msg) { failLines.push(`  ✗ ${msg}`); failures++; }
function pass(msg) { passLines.push(`  ✓ ${msg}`); }

// Check A: manifest → workflow (every required secret is present in the workflow)
for (const [name, meta] of Object.entries(secrets)) {
  if (AUTO_INJECTED.has(name)) continue;
  for (const wf of (meta.required_by ?? [])) {
    const used = wfSecretMap[wf];
    if (!used) {
      fail(`${wf}: not found on disk but declared required for ${name}`);
    } else if (!used.has(name)) {
      fail(`${wf}: env block is missing secret ${name} (declared required in manifest)`);
    } else {
      pass(`${wf} ← ${name}`);
    }
  }
}

// Check B: workflow → manifest (every secret used is declared for THIS workflow)
for (const [wf, used] of Object.entries(wfSecretMap)) {
  for (const name of used) {
    if (AUTO_INJECTED.has(name)) continue;
    const meta = secrets[name];
    if (!meta) {
      fail(`${wf}: references undeclared secret ${name} (add it to secrets-manifest.json)`);
    } else if (!(meta.required_by ?? []).includes(wf)) {
      fail(`${wf}: references ${name}, but ${wf} is missing from ${name}'s required_by in secrets-manifest.json`);
    } else {
      pass(`${wf} → ${name}`);
    }
  }
}

// ── Report ────────────────────────────────────────────────────────────────────

const secretCount  = Object.keys(secrets).length;
const wfCount      = wfFiles.length;
const passCount    = passLines.length;

if (failures === 0) {
  console.log(`✅ Secrets manifest audit passed`);
  console.log(`   ${secretCount} secrets · ${wfCount} workflows · ${passCount} references verified`);
} else {
  console.error(`❌ Secrets manifest audit FAILED — ${failures} issue(s)\n`);
  for (const l of failLines) console.error(l);
  console.error(`\nFix: add the missing secret to the workflow env block AND update secrets-manifest.json.`);
  process.exit(1);
}
