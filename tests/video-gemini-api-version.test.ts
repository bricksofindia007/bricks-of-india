// Gemini clients in the video generators use the v1beta API version (order 0760). The default version rejects the system
// instruction the generators send (400 INVALID_ARGUMENT, 6 Nov 2026), so every Gemini client must name the version.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

const CLIENTS = ['scripts/video/engine.py', 'scripts/video/quiet_panic_script_gen.py'];

describe('Gemini client API version in the video generators', () => {
  for (const f of CLIENTS) {
    it(`${f}: every genai.Client(...) call names api_version 'v1beta'`, () => {
      const src = read(f);
      const lines = src.split('\n').filter((l) => l.includes('genai.Client('));
      expect(lines.length, f).toBeGreaterThan(0);
      for (const line of lines) {
        expect(line, f).toContain("http_options=types.HttpOptions(api_version='v1beta')");
      }
    });
  }

  it('the types module is imported before each client is created (engine.py)', () => {
    const src = read('scripts/video/engine.py');
    const imp = src.indexOf('from google.genai import types');
    const client = src.indexOf('genai.Client(api_key=gemini_key');
    expect(imp).toBeGreaterThan(-1);
    expect(imp).toBeLessThan(client);
  });

  it('the Gemini model and system instruction are unchanged', () => {
    expect(read('scripts/video/engine.py')).toContain("model=\"gemini-2.5-flash\", system=prompts.SYSTEM_PROMPT");
    expect(read('scripts/video/quiet_panic_script_gen.py')).toContain("model='gemini-2.5-flash', system=system_prompt");
  });
});
