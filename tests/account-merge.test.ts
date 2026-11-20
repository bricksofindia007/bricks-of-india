// First sign-in merge rule (src/lib/account-merge.ts): union, no duplicates, the account copy wins, the 500 limit keeps the newest.
import { describe, it, expect } from 'vitest';
import { mergeOnSignIn, ACCOUNT_LIST_LIMIT } from '../src/lib/account-merge';
import { MY_SETS_LIMIT } from '../src/lib/my-collection';

type Item = { set: string; added_at: string; name?: string };
const at = (day: number) => `2026-10-${String(day).padStart(2, '0')}T10:00:00.000Z`;
const item = (set: string, day: number, name = `Set ${set}`): Item => ({ set, added_at: at(day), name });

describe('mergeOnSignIn', () => {
  it('the limit matches the My Collection limit', () => {
    expect(ACCOUNT_LIST_LIMIT).toBe(MY_SETS_LIMIT);
    expect(ACCOUNT_LIST_LIMIT).toBe(500);
  });

  it('adds browser-only items to the account list', () => {
    const r = mergeOnSignIn([item('10001', 1)], [item('10002', 2)]);
    expect(r.list.map((i) => i.set)).toEqual(['10002', '10001']);
    expect(r.dropped).toBe(0);
  });

  it('a set in both lists appears once, and the account copy wins', () => {
    const acct = item('10001', 1, 'Account name');
    const browser = item('10001', 5, 'Browser name');
    const r = mergeOnSignIn([acct], [browser]);
    expect(r.list).toHaveLength(1);
    expect(r.list[0].name).toBe('Account name');
    expect(r.list[0].added_at).toBe(at(1));
  });

  it('duplicates inside the browser list count once', () => {
    const r = mergeOnSignIn([], [item('10001', 1), item('10001', 2), item('10002', 3)]);
    expect(r.list.map((i) => i.set).sort()).toEqual(['10001', '10002']);
  });

  it('empty lists give an empty result', () => {
    expect(mergeOnSignIn([], [])).toEqual({ list: [], dropped: 0 });
  });

  it('an empty account list takes the whole browser list', () => {
    const r = mergeOnSignIn([], [item('10001', 1), item('10002', 2)]);
    expect(r.list).toHaveLength(2);
    expect(r.dropped).toBe(0);
  });

  it('over the limit, the newest items are kept and the oldest dropped', () => {
    const account = Array.from({ length: 495 }, (_, i) => item(String(10000 + i), 1));
    const browser = Array.from({ length: 10 }, (_, i) => item(String(20000 + i), 20 + i));
    const r = mergeOnSignIn(account, browser);
    expect(r.list).toHaveLength(500);
    expect(r.dropped).toBe(5);
    // The ten newest browser items are all kept (added on days 20 to 29).
    const kept = new Set(r.list.map((i) => i.set));
    for (const b of browser) expect(kept.has(b.set)).toBe(true);
    // 10 newer browser items + 490 of the 495 old account items = 500. The 5 dropped are the oldest by set number.
    expect(r.list.filter((i) => i.added_at === at(1))).toHaveLength(490);
  });

  it('a list exactly at the limit drops nothing', () => {
    const account = Array.from({ length: 500 }, (_, i) => item(String(10000 + i), 1));
    const r = mergeOnSignIn(account, []);
    expect(r.list).toHaveLength(500);
    expect(r.dropped).toBe(0);
  });

  it('the limit can be given explicitly', () => {
    const r = mergeOnSignIn([item('1', 1), item('2', 2)], [item('3', 3)], 2);
    expect(r.list.map((i) => i.set)).toEqual(['3', '2']);
    expect(r.dropped).toBe(1);
  });

  it('does not change the input arrays', () => {
    const account = [item('10001', 1)];
    const browser = [item('10002', 2)];
    mergeOnSignIn(account, browser);
    expect(account).toHaveLength(1);
    expect(browser).toHaveLength(1);
  });
});
