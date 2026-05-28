'use strict';
/**
 * CATALOG-04 v2 — update is_retiring_soon and retired flags on sets table.
 * Runs weekly via .github/workflows/retiring-soon.yml
 *
 * Logic:
 *   retired = true         if retirement_date <= today
 *   is_retiring_soon = true  if retirement_date is within next 90 days (but not yet retired)
 *   is_retiring_soon = false if retirement_date > today + 90 days (reset stale flags)
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const today        = new Date();
const in90Days     = new Date(today); in90Days.setDate(in90Days.getDate() + 90);
const todayStr     = today.toISOString().slice(0, 10);
const in90DaysStr  = in90Days.toISOString().slice(0, 10);

console.log(`━━ update-retiring-soon ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`Today: ${todayStr}  |  90-day horizon: ${in90DaysStr}`);

let retiredCount = 0, soonCount = 0, resetCount = 0;

// 1. Mark as retired: retirement_date <= today
const { data: retiredRows, error: e1 } = await sb
  .from('sets')
  .update({ retired: true, is_retiring_soon: false })
  .lte('retirement_date', todayStr)
  .eq('retired', false)
  .select('set_number, retirement_date');

if (e1) { console.error('FAIL (retired update):', e1.message); process.exit(1); }
retiredCount = (retiredRows ?? []).length;
console.log(`Marked retired:         ${retiredCount}`);
if (retiredCount > 0) {
  for (const r of retiredRows) console.log(`  ${r.set_number}  retired ${r.retirement_date}`);
}

// 2. Mark as retiring soon: retirement_date within next 90 days (and not already retired)
const { data: soonRows, error: e2 } = await sb
  .from('sets')
  .update({ is_retiring_soon: true })
  .gt('retirement_date', todayStr)
  .lte('retirement_date', in90DaysStr)
  .eq('is_retiring_soon', false)
  .eq('retired', false)
  .select('set_number, retirement_date');

if (e2) { console.error('FAIL (retiring-soon update):', e2.message); process.exit(1); }
soonCount = (soonRows ?? []).length;
console.log(`Marked retiring soon:   ${soonCount}`);
if (soonCount > 0) {
  for (const r of soonRows) console.log(`  ${r.set_number}  retires ${r.retirement_date}`);
}

// 3. Reset stale is_retiring_soon flags: retirement_date > today + 90 days
const { data: resetRows, error: e3 } = await sb
  .from('sets')
  .update({ is_retiring_soon: false })
  .gt('retirement_date', in90DaysStr)
  .eq('is_retiring_soon', true)
  .select('set_number');

if (e3) { console.error('FAIL (reset update):', e3.message); process.exit(1); }
resetCount = (resetRows ?? []).length;
console.log(`Reset stale soon flags: ${resetCount}`);

console.log(`\nDone. retired=${retiredCount}, soon=${soonCount}, reset=${resetCount}`);
