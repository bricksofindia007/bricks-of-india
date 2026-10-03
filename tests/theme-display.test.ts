import { describe, it, expect } from 'vitest';
import { shownTheme } from '../src/lib/theme-display';

describe('a raw "Unknown" theme is never shown', () => {
  it('hides Unknown and blanks', () => {
    for (const t of ['Unknown', 'unknown', ' Unknown ', '', null, undefined]) expect(shownTheme(t)).toBeNull();
  });
  it('keeps real themes', () => {
    expect(shownTheme('Modular Buildings')).toBe('Modular Buildings');
  });
});
