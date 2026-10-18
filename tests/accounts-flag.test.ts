// Accounts flag: off until the accounts launch. The TypeScript and Python flag files must agree.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FEATURE_FLAGS } from '../src/lib/feature-flags';

const root = join(__dirname, '..');

describe('accounts flag', () => {
  it('is off by default', () => {
    expect(FEATURE_FLAGS.accountsEnabled).toBe(false);
  });

  it('the Python flag file agrees (off)', () => {
    expect(readFileSync(join(root, 'config/feature_flags.py'), 'utf8')).toMatch(/"accounts_enabled": False/);
  });
});
