// Tests for the US-only write helpers (order 0410 item 4). Run: node --test scripts/lib/mrp-usd.test.cjs
// Stubs only: no database, no network. The rpc stub records every call.
const test = require('node:test');
const assert = require('node:assert/strict');
const { positiveUsdRows, writeUsOnly, batches, WRITE_BATCH } = require('./mrp-usd.cjs');

test('only positive numeric dollar prices become rows', () => {
  const rows = positiveUsdRows({ '10332': 199.99, '21371': 0, '40812': -5, '76304': null, '42210': 'abc', '1000': 49, '2000': NaN });
  assert.deepEqual(rows.map((r) => r.set_number).sort(), ['1000', '10332']);
  assert.ok(rows.every((r) => r.us_price_usd > 0));
});

test('an empty map writes nothing and makes no call', async () => {
  let calls = 0;
  const r = await writeUsOnly({}, async () => { calls++; return { data: 0, error: null }; });
  assert.equal(calls, 0);
  assert.deepEqual(r, { ok: 0, failed: 0, rows: 0 });
});

test('writes go only through the US price function, one call per batch', async () => {
  const many = {};
  for (let i = 0; i < WRITE_BATCH + 3; i++) many[String(10000 + i)] = 10 + i;
  const names = [];
  const seen = [];
  const r = await writeUsOnly(many, async (name, args) => {
    names.push(name);
    seen.push(...args.p_rows);
    return { data: args.p_rows.length, error: null };
  });
  assert.ok(names.every((n) => n === 'sets_bulk_us_price'), 'only the US price function is called');
  assert.equal(names.length, 2, 'two batches for WRITE_BATCH + 3 rows');
  assert.equal(r.ok, WRITE_BATCH + 3);
  assert.equal(r.failed, 0);
  assert.ok(seen.every((row) => Object.keys(row).sort().join(',') === 'set_number,us_price_usd'), 'rows carry only the two fields');
});

test('a failed batch is counted and not retried row by row', async () => {
  const data = { '1': 10, '2': 20, '3': 30 };
  let calls = 0;
  const r = await writeUsOnly(data, async () => { calls++; return { data: null, error: { message: 'stub failure' } }; });
  assert.equal(calls, 1);
  assert.deepEqual(r, { ok: 0, failed: 3, rows: 3 });
});

test('batches split by size', () => {
  assert.deepEqual(batches([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});
