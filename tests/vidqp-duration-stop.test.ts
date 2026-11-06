// The Quiet Panic length gate stops the run before any render when it fails (order 0760). The window is unchanged.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(__dirname, '..');
const src = readFileSync(join(root, 'scripts/video/generate_quiet_panic_video.py'), 'utf8');

describe('Quiet Panic length gate', () => {
  it('keeps the window: 45.0 to 55.0 seconds, plus or minus 10 percent', () => {
    expect(src).toMatch(/^DURATION_TARGET_MIN = 45\.0$/m);
    expect(src).toMatch(/^DURATION_TARGET_MAX = 55\.0$/m);
    expect(src).toMatch(/^DURATION_TOLERANCE = 0\.10\b/m);
  });

  it('defines the stop exception', () => {
    expect(src).toMatch(/class DurationGateStop\(RuntimeError\):/);
  });

  it('raises it when the duration gate fails, right after the gates run', () => {
    const gatesAt = src.indexOf('gate_results = run_all_gates(');
    const stopAt = src.indexOf("if not gate_results['duration']['pass']:");
    expect(gatesAt).toBeGreaterThan(-1);
    expect(stopAt).toBeGreaterThan(gatesAt);
    expect(src.slice(stopAt, stopAt + 200)).toMatch(/raise DurationGateStop\(/);
  });

  it('the stop comes before every image, audio and video step of the render', () => {
    const stopAt = src.indexOf("if not gate_results['duration']['pass']:");
    const renderSteps = ['resolve_candidate_images(', 'concat_audio(mixed_paths', 'apply_final_loudnorm(', 'write_videofile('];
    for (const step of renderSteps) {
      const at = src.indexOf(step, stopAt);
      expect(at, step).toBeGreaterThan(stopAt);
    }
  });

  it('the other gates keep the render-and-block behaviour (only duration stops)', () => {
    expect(src).toMatch(/all_passed = all\(r\['pass'\] for r in gate_results\.values\(\)\)/);
    expect(src).toMatch(/held_for_review = \(not all_passed\) and only_held_failures\(gate_results\)/);
  });
});
