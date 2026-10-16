// A review is written only for a set that is in the catalogue and has an
// in-stock store listing. Checked before a review is generated.
export async function reviewListingCheck(sb, setNumber) {
  if (!setNumber) return { ok: false, reason: 'set could not be identified' };

  const { data: set, error: setErr } = await sb
    .from('sets')
    .select('set_number')
    .eq('set_number', setNumber)
    .maybeSingle();
  if (setErr) throw setErr;
  if (!set) return { ok: false, reason: `set ${setNumber} is not in the catalogue` };

  const { data: rows, error: spErr } = await sb
    .from('store_prices')
    .select('store_id')
    .eq('set_id', setNumber)
    .eq('in_stock', true)
    .limit(1);
  if (spErr) throw spErr;
  if (!rows || rows.length === 0) return { ok: false, reason: `set ${setNumber} has no in-stock store listing` };

  return { ok: true };
}
