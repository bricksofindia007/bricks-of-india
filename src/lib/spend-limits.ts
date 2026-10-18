// Spend limits: pure decisions. The numbers come from config/spend-limits.json; nothing here is hard-coded.
// A limit reads as: below the warning line = ok; at the warning line = warn; at or past the stop line = stop.
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
export type ProviderUsage = { calls: number; tokens: number; rupees: number };

/** Rupee spend for the day: warn at Rs 6, stop at Rs 10. */
export function rupeeLevel(inr: number): Level {
  const r = limits.rupee_stop;
  if (inr >= r.stop_inr) return 'stop';
  if (inr >= r.warn_inr) return 'warn';
  return 'ok';
}

/**
 * One AI call is allowed only while the day's totals are below every cap: calls, tokens, and the rupee
 * stop. Refused at the stop, until the next day. Warns at 60% of a token or call cap, and at the rupee
 * warning. Tokens are input plus output.
 */
export function aiCallDecision(provider: ProviderName, used: ProviderUsage) {
  const p = limits.ai.providers[provider];
  const w = limits.ai.warn_fraction;
  const callLevel = levelFor(used.calls, p.daily_calls, w);
  const tokenLevel = levelFor(used.tokens, p.daily_tokens, w);
  const rupeeLvl = rupeeLevel(used.rupees);
  const levels = [callLevel, tokenLevel, rupeeLvl];
  const level: Level = levels.includes('stop') ? 'stop' : levels.includes('warn') ? 'warn' : 'ok';
  return { allowed: level !== 'stop', level, callLevel, tokenLevel, rupeeLevel: rupeeLvl };
}

/**
 * Rupee cost of one call: input and output tokens at the model's USD per-million prices, times the stored
 * USD to INR rate. Null while the model has no price, so the caller counts only the caps for it.
 */
export function rupeesFor(model: string, inputTokens: number, outputTokens: number): number | null {
  const prices = limits.ai.prices_usd_per_million_tokens as Record<string, { input: number; output: number } | null>;
  const price = prices[model];
  if (!price) return null;
  const usd = (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output;
  return usd * limits.usd_inr_stored.rate;
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
