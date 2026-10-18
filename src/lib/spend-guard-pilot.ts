// Spend guard pilot: checks and records one provider's daily AI calls against the shared counter.
// Behind FEATURE_FLAGS.aiSpendGuardPilot (off). With the flag off, nothing is read and nothing is written.
// If today's counts cannot be read, the call is refused (fails closed).
import { FEATURE_FLAGS } from './feature-flags';
import { aiCallDecision, type ProviderName } from './spend-limits';
import { createServerClient } from './supabase';

/** The UTC day the counter is keyed by. */
export function usageDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function guardAiCall(provider: ProviderName, now: Date = new Date()): Promise<{ allowed: boolean; reason: string | null }> {
  if (!FEATURE_FLAGS.aiSpendGuardPilot) return { allowed: true, reason: null };
  const { data, error } = await createServerClient()
    .from('ai_daily_usage')
    .select('calls, tokens')
    .eq('day', usageDay(now))
    .eq('provider', provider)
    .maybeSingle();
  if (error) return { allowed: false, reason: 'usage unreadable' };
  const used = { calls: data?.calls ?? 0, tokens: Number(data?.tokens ?? 0) };
  const d = aiCallDecision(provider, used);
  return { allowed: d.allowed, reason: d.allowed ? null : `${provider} daily cap reached` };
}

export async function recordAiCall(provider: ProviderName, tokens: number, now: Date = new Date()): Promise<void> {
  if (!FEATURE_FLAGS.aiSpendGuardPilot) return;
  const { error } = await createServerClient().rpc('ai_usage_add', { p_day: usageDay(now), p_provider: provider, p_calls: 1, p_tokens: tokens });
  if (error) console.error('[spend-guard] count not recorded:', error.message);
}
