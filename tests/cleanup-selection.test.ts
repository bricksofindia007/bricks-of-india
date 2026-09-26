/**
 * Storage cleanup selection -- issue #177. Hardcoded mock rows, no DB or
 * storage access. Asserts the deny-by-default contract of
 * scripts/lib/cleanup-selection.mjs: only posted_both/discarded rows past
 * the age guard are ever selected, and any path also referenced by a row in
 * another status (approved, pending_approval, publish_blocked, rejected,
 * unknown/NULL) is never deleted.
 *
 * Run: npx vitest run tests/cleanup-selection.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  candidatePaths, protectedPaths, finalizeSelection, rootFilePaths, TERMINAL_STATUSES,
} from '../scripts/lib/cleanup-selection.mjs';

const QP = 'quiet-panic-assets';
const SA = 'social-assets';
const url = (bucket: string, path: string) =>
  `https://x.supabase.co/storage/v1/object/public/${bucket}/${path}`;

const CUTOFF = '2026-09-21T00:00:00.000Z';
const OLD = '2026-09-01T00:00:00.000Z';
const RECENT = '2026-09-23T00:00:00.000Z';

function select(rows: any[], bucket: string, cutoff: string | null = CUTOFF) {
  return finalizeSelection(candidatePaths(rows, bucket, cutoff), protectedPaths(rows, bucket));
}

describe('status allow-list', () => {
  it('is exactly posted_both + discarded', () => {
    expect([...TERMINAL_STATUSES].sort()).toEqual(['discarded', 'posted_both']);
  });

  for (const status of ['approved', 'pending_approval', 'publish_blocked', 'rejected', 'generating', null, undefined]) {
    it(`never selects a ${String(status)} row, even when old and with the age guard off`, () => {
      const rows = [{ id: 1, status, posted_at: OLD, storage_url: url(QP, 'a.mp4') }];
      expect(select(rows, QP).toDelete).toEqual([]);
      expect(select(rows, QP, null).toDelete).toEqual([]);
    });
  }

  it('selects an old posted_both row', () => {
    const rows = [{ id: 1, status: 'posted_both', posted_at: OLD, storage_url: url(QP, 'a.mp4') }];
    expect(select(rows, QP).toDelete).toEqual(['a.mp4']);
  });
});

describe('age guard', () => {
  it('keeps a posted_both row inside the 72h window', () => {
    const rows = [{ id: 1, status: 'posted_both', posted_at: RECENT, storage_url: url(QP, 'a.mp4') }];
    expect(select(rows, QP).toDelete).toEqual([]);
  });

  it('never passes a NULL posted_at while the guard is on (known discarded-row gap)', () => {
    const rows = [{ id: 1, status: 'discarded', posted_at: null, storage_url: url(QP, 'a.mp4') }];
    expect(select(rows, QP).toDelete).toEqual([]);
    expect(select(rows, QP, null).toDelete).toEqual(['a.mp4']);
  });
});

describe('deny layer: shared paths', () => {
  it('protects an approved row whose storage_url equals a terminal row\'s', () => {
    const rows = [
      { id: 1, status: 'posted_both', posted_at: OLD, storage_url: url(QP, 'shared.mp4') },
      { id: 2, status: 'approved', posted_at: null, storage_url: url(QP, 'shared.mp4') },
    ];
    const r = select(rows, QP, null);
    expect(r.toDelete).toEqual([]);
    expect(r.blocked).toEqual(['shared.mp4']);
  });

  it('protects a pending_approval row\'s qc frame shared with a discarded row', () => {
    const rows = [
      { id: 1, status: 'discarded', posted_at: OLD, storage_url: url(SA, 'video/a.mp4'), qc_frame_urls: [url(SA, 'qc/f1.jpg')] },
      { id: 2, status: 'pending_approval', posted_at: null, storage_url: url(SA, 'video/b.mp4'), qc_frame_urls: [url(SA, 'qc/f1.jpg')] },
    ];
    const r = select(rows, SA);
    expect(r.toDelete).toEqual(['video/a.mp4']);
    expect(r.blocked).toEqual(['qc/f1.jpg']);
  });

  it('protects a rejected row whose storage_url is still referenced', () => {
    const rows = [
      { id: 1, status: 'posted_both', posted_at: OLD, storage_url: url(QP, 'x.mp4') },
      { id: 2, status: 'rejected', posted_at: null, storage_url: url(QP, 'x.mp4') },
    ];
    expect(select(rows, QP).toDelete).toEqual([]);
  });
});

describe('real 2026-09-24 approved assets are never selected', () => {
  // Shapes copied from the live rows named in issue #177.
  const approvedQp = [
    '11377_2026-09-22_035951.mp4', '21067_2026-09-22_091642.mp4',
    '77237_2026-09-22_143347.mp4', '40954_2026-09-23_085035.mp4',
  ].map((p, i) => ({ id: 34 + i, status: 'approved', posted_at: null, storage_url: url(QP, p) }));

  it('quiet-panic-assets: QP #34-#37 absent even with guard off', () => {
    const rows = [
      ...approvedQp,
      { id: 6, status: 'posted_both', posted_at: OLD, storage_url: url(QP, '77243_2026-07-30_000000.mp4') },
    ];
    const r = select(rows, QP, null);
    expect(r.toDelete).toEqual(['77243_2026-07-30_000000.mp4']);
    for (const r0 of approvedQp) expect(r.toDelete.join()).not.toContain(r0.storage_url.split('/').pop());
  });

  it('social-assets: approved VID-P4 video + frames absent', () => {
    const rows = [
      { id: 62, status: 'approved', posted_at: null, storage_url: url(SA, 'video/21398280.mp4'), qc_frame_urls: [url(SA, 'qc/62-1.jpg')] },
      { id: 63, status: 'posted_both', posted_at: OLD, storage_url: url(SA, 'video/63.mp4'), qc_frame_urls: [url(SA, 'qc/63-1.jpg')] },
    ];
    expect(select(rows, SA, null).toDelete).toEqual(['qc/63-1.jpg', 'video/63.mp4']);
  });

  it('QP #4/#5-style discarded rows with no storage_url select nothing', () => {
    const rows = [4, 5].map((id) => ({ id, status: 'discarded', posted_at: null, storage_url: null }));
    expect(select(rows, QP, null).toDelete).toEqual([]);
  });
});

describe('social-automation root files', () => {
  it('only known naming shapes of fully-posted sets', () => {
    const names = ['76342-1_shorts.mp4', '76342-1_feed_7.jpg', '99999-1_reels.mp4', 'video', 'random.mp4'];
    expect(rootFilePaths(names, ['76342-1'])).toEqual(['76342-1_shorts.mp4', '76342-1_feed_7.jpg']);
  });
});
