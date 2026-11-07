import { describe, it, expect } from 'vitest';
import { bareExpectClauses, lintFile } from '../scripts/ci/db-migrate.mjs';

describe('bareExpectClauses (expect SQL must not contain a bare count in an AND)', () => {
  it('flags a clause that is a bare number inside an AND', () => {
    expect(bareExpectClauses("select count(*) from t where slug = 'x' and position('Use' in content)")).toEqual(["position('' in content)"]);
  });

  it('accepts a clause that is a condition', () => {
    expect(bareExpectClauses("select count(*) from t where slug = 'x' and position('Use' in content) > 0")).toEqual([]);
    expect(bareExpectClauses("select count(*) from t where slug = 'x' and position('Use' in content) = 0")).toEqual([]);
  });

  it('does not split inside parentheses or quoted text', () => {
    expect(bareExpectClauses("select case when (select count(*) from s where a = 1 and b = 2) = 1 then 1 else 0 end")).toEqual([]);
    expect(bareExpectClauses("select count(*) from t where note = 'x and y' and slug = 'z'")).toEqual([]);
  });
});

describe('lintFile rejects a bare count in an expect line', () => {
  const header = (before: string, after: string) => [
    '-- boi:issue 339',
    '-- boi:backup-tables public.news_articles',
    `-- boi:expect-before ${before}`,
    `-- boi:expect-after ${after}`,
    'update public.news_articles set content = content where slug = \'x\';',
  ].join('\n');

  it('rejects a bare count in expect-before', () => {
    const sql = header("select count(*) from public.news_articles where slug = 'x' and position('Use' in content) = 0 = 1", "select count(*) from public.news_articles where slug = 'x' and position('Use' in content) > 0 = 1");
    expect(lintFile('fix', '339-x.sql', sql)).toEqual([]);
  });

  it('rejects a bare count in expect-after (the trailing = 1 is the expected value, leaving a bare number)', () => {
    const sql = header("select count(*) from public.news_articles where slug = 'x' = 1", "select count(*) from public.news_articles where slug = 'x' and position('Use' in content) = 1");
    const errs = lintFile('fix', '339-x.sql', sql);
    expect(errs.some((e) => e.includes('expect-after has a bare count'))).toBe(true);
  });

  it('rejects the old form that leaves a bare count (expect-before ends in = 0 with no expected value)', () => {
    const sql = header("select count(*) from public.news_articles where slug = 'x' and position('Use' in content) = 0", "select count(*) from public.news_articles where slug = 'x' = 1");
    const errs = lintFile('fix', '339-x.sql', sql);
    expect(errs.some((e) => e.includes('expect-before has a bare count'))).toBe(true);
  });
});
