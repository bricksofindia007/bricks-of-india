// FP6.4 hard quota guards (P4 Step 2, 27 Sep 2026).
//
// Why: the Free plan's grace period is used up -- the next breach of ANY
// quota restricts the project with no warning (Supabase support, P0.3).
// Egress is projected ~3.85 GB of 5 GB this cycle and storage grows with
// the video pipelines. Check 11/11b only ALERT; these guards make jobs act.
//
// One read per run of the SAME in-database estimates Check 11/11b use:
//   public.db_usage_report()   -> db_size_mb, storage_mb (+ by bucket)
//   public.capacity_snapshot() -> egress projection via capacity-estimate.mjs
// and three questions:
//   mayUpload()             storage: alert >= 700 MB, REFUSE >= 800 MB
//   mayWriteNonEssential()  DB size: alert >= 350 MB, PAUSE  >= 400 MB
//   mayReadNonEssential()   egress:  alert >= 3.5 GB projected, PAUSE >= 4.0 GB projected
// Essential paths (scrapers, price writes, page renders) are never paused
// by these guards; they only call alertLevels() for logging.
//
// If usage can't be read: every question answers { allowed: false } with
// reason 'usage-unreadable' -- non-essential paths fail CLOSED (pause and
// alert); essential callers ignore `allowed` and just alert.
//
// Simulation (tests and the D-6 live proof ONLY, never by filling storage):
//   BOI_QUOTA_SIMULATE="storage_mb=800,db_mb=181,egress_projected_gb=3.85"
// replaces the live reading (any key omitted falls back to the live value).

import { estimateCycleUsage } from './capacity-estimate.mjs';

export const LIMITS = Object.freeze({
  storage: { alertMb: 700, blockMb: 800 },     // 1 GB Free-plan quota
  db:      { alertMb: 350, blockMb: 400 },     // 500 MB read-only limit
  egress:  { alertGb: 3.5, blockGb: 4.0 },     // 5 GB Free-plan quota, projected to cycle end
});

/** Parse BOI_QUOTA_SIMULATE into { storage_mb?, db_mb?, egress_projected_gb? }. */
export function parseSimulation(raw = process.env.BOI_QUOTA_SIMULATE) {
  if (!raw) return null;
  const out = {};
  for (const part of String(raw).split(',')) {
    const [k, v] = part.split('=').map((x) => x.trim());
    if (['storage_mb', 'db_mb', 'egress_projected_gb'].includes(k) && Number.isFinite(Number(v))) out[k] = Number(v);
  }
  return Object.keys(out).length ? out : null;
}

/** Read usage once. Returns { ok, storageMb, dbMb, egressProjectedGb, simulated, error? }. */
export async function readUsage(sb, { now = new Date(), simulate = parseSimulation() } = {}) {
  let live = { storageMb: null, dbMb: null, egressProjectedGb: null };
  let error = null;
  try {
    const [{ data: rep, error: e1 }, { data: snaps, error: e2 }] = await Promise.all([
      sb.rpc('db_usage_report'),
      sb.rpc('capacity_snapshot', { p_days: 40 }),
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    const est = estimateCycleUsage(snaps ?? [], now);
    live = {
      storageMb: Number(rep.storage_mb),
      dbMb: Number(rep.db_size_mb),
      egressProjectedGb: est.ok ? est.projectedEgressGB : null,
    };
  } catch (e) {
    error = e?.message ?? String(e);
  }
  const u = {
    storageMb: simulate?.storage_mb ?? live.storageMb,
    dbMb: simulate?.db_mb ?? live.dbMb,
    egressProjectedGb: simulate?.egress_projected_gb ?? live.egressProjectedGb,
  };
  const ok = [u.storageMb, u.dbMb, u.egressProjectedGb].every((x) => Number.isFinite(x));
  return { ok, ...u, simulated: !!simulate, error: ok ? null : (error ?? 'egress estimate unavailable') };
}

function decide(value, alertAt, blockAt, unit, what) {
  if (!Number.isFinite(value)) {
    return { allowed: false, level: 'critical', reason: 'usage-unreadable', detail: `${what} usage could not be read` };
  }
  if (value >= blockAt) return { allowed: false, level: 'critical', reason: `${what}-block`, detail: `${what} ${value} ${unit} >= ${blockAt} ${unit} guard` };
  if (value >= alertAt) return { allowed: true, level: 'warning', reason: `${what}-alert`, detail: `${what} ${value} ${unit} >= ${alertAt} ${unit} alert line` };
  return { allowed: true, level: 'ok', reason: 'ok', detail: `${what} ${value} ${unit}` };
}

export const mayUpload = (u) => decide(u.storageMb, LIMITS.storage.alertMb, LIMITS.storage.blockMb, 'MB', 'storage');
export const mayWriteNonEssential = (u) => decide(u.dbMb, LIMITS.db.alertMb, LIMITS.db.blockMb, 'MB', 'db');
export const mayReadNonEssential = (u) => decide(u.egressProjectedGb, LIMITS.egress.alertGb, LIMITS.egress.blockGb, 'GB (projected)', 'egress');

/** All three decisions, for logging and alerts. */
export function alertLevels(u) {
  return { storage: mayUpload(u), db: mayWriteNonEssential(u), egress: mayReadNonEssential(u) };
}

/**
 * Guard for a non-essential job's entry point. Reads usage once, evaluates the
 * questions the job needs (`needs`: any of 'upload','write','read'), and on a
 * refusal alerts through the caller-supplied existing sender and returns
 * { proceed: false }. Callers exit 0 (a guarded pause is not a failure).
 */
export async function guardNonEssential(sb, jobName, needs, sendAlert) {
  const u = await readUsage(sb);
  const fns = { upload: mayUpload, write: mayWriteNonEssential, read: mayReadNonEssential };
  const blocked = needs.map((n) => [n, fns[n](u)]).filter(([, d]) => !d.allowed);
  const warnings = needs.map((n) => [n, fns[n](u)]).filter(([, d]) => d.allowed && d.level === 'warning');
  const tag = u.simulated ? ' [SIMULATED READING]' : '';
  console.log(`[quota-guard] ${jobName}: storage=${u.storageMb} MB db=${u.dbMb} MB egress_projected=${u.egressProjectedGb?.toFixed?.(2) ?? u.egressProjectedGb} GB${tag}`);
  for (const [, d] of warnings) console.log(`[quota-guard] WARNING ${d.detail}`);
  if (blocked.length === 0) return { proceed: true, usage: u };
  const lines = blocked.map(([n, d]) => `- ${n}: ${d.detail}${d.reason === 'usage-unreadable' ? ` (${u.error})` : ''}`).join('\n');
  console.log(`[quota-guard] PAUSED ${jobName}:\n${lines}`);
  if (sendAlert) {
    await sendAlert(
      `🚨 BOI quota guard paused ${jobName}${tag}`,
      `${jobName} did not run because a Free-plan quota guard is closed (FP6.4):\n${lines}\n\nNon-essential jobs pause at these lines; essential paths (scrapers, price writes, page renders) keep running. The grace period is used up, so going over restricts the project immediately.${u.simulated ? '\n\nThis reading is SIMULATED (BOI_QUOTA_SIMULATE) -- a proof run, not a real breach.' : ''}`,
    ).catch((e) => console.error('[quota-guard] alert send failed:', e?.message ?? e));
  }
  return { proceed: false, usage: u };
}
