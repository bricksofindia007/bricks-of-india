// Spend limits: pure decisions. The numbers come from config/spend-limits.json; nothing here is hard-coded.
// A limit reads as: below the warning line = ok; at the warning line = warn; at the stop line = stop.
import limits from '../../config/spend-limits.json';

export type Level = 'ok' | 'warn' | 'stop';

export const config = limits;

/** ok below `warnFraction` of the cap, warn from there, stop at or past the cap. */
export function levelFor(used: number, cap: number, warnFraction: number): Level {
  if (used >= cap) return 'stop';
  if (used >= cap * warnFraction) return 'warn';
  return 'ok';
}

export type ProviderName = keyof typeof limits.ai.providers;
export type ProviderUsage = { calls: number; tokens: number };

/**
 * One AI call is allowed only while the day's totals are below the caps. Refused at 100%, until the next day.
 * A warning comes at 60% of either cap. Free providers (rupee_free) have no rupee figure, so only their
 * caps apply.
 */
export function aiCallDecision(provider: ProviderName, used: ProviderUsage) {
  const p = limits.ai.providers[provider];
  const callLevel = levelFor(used.calls, p.daily_calls, limits.ai.warn_fraction);
  const tokenLevel = levelFor(used.tokens, p.daily_tokens, limits.ai.warn_fraction);
  const level: Level = callLevel === 'stop' || tokenLevel === 'stop' ? 'stop' : callLevel === 'warn' || tokenLevel === 'warn' ? 'warn' : 'ok';
  return { allowed: level !== 'stop', level, callLevel, tokenLevel };
}

/**
 * Rupee cost of a call. Returns null while the model has no verified price, so the caller uses only the
 * call and token caps. Free providers return 0.
 */
export function rupeesFor(provider: ProviderName, model: string, tokens: number): number | null {
  if (limits.ai.providers[provider].rupee_free) return 0;
  const perMillion = (limits.ai.rupee_price_per_million_tokens as Record<string, number | null>)[model];
  if (perMillion == null) return null;
  return (tokens / 1_000_000) * perMillion;
}

/** Rupee spend for the day: warn at Rs 6, stop at Rs 10 (binding once prices are set). */
export function rupeeLevel(inr: number): Level {
  const r = limits.rupee_stop;
  if (inr >= r.stop_inr) return 'stop';
  if (inr >= r.warn_inr) return 'warn';
  return 'ok';
}

export type EgressLevel = 'ok' | 'alert' | 'guard' | 'stop';

/**
 * Supabase egress, in GB projected to the cycle end: alert at 3.5 (send an alert), guard at 4.0 (pause
 * non-essential reads), stop at 4.6 (stop all new reads that can be stopped).
 */
export function egressLevel(gb: number): EgressLevel {
  const e = limits.supabase_egress_gb;
  if (gb >= e.stop) return 'stop';
  if (gb >= e.guard) return 'guard';
  if (gb >= e.alert) return 'alert';
  return 'ok';
}

/** R2 Class A operations this month: warn at 60% of the stop, stop at 900,000. */
export function r2ClassALevel(ops: number): Level {
  return levelFor(ops, limits.r2_class_a_ops_month.stop, limits.r2_class_a_ops_month.alert_fraction);
}

/** Brevo sends today: warn at 60% of 270, stop at 270. */
export function brevoLevel(sent: number): Level {
  return levelFor(sent, limits.brevo_emails_day.stop, limits.brevo_emails_day.alert_fraction);
}

/** Resend sends today: warn at 60% of 90, stop at 90. */
export function resendLevel(sent: number): Level {
  return levelFor(sent, limits.resend_emails_day.stop, limits.resend_emails_day.alert_fraction);
}
