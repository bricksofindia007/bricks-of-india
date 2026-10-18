// Spend guard pilot: checks and records one provider's daily AI calls against the per-model counter.
// Behind FEATURE_FLAGS.aiSpendGuardPilot (off). With the flag off, nothing is read and nothing is written.
// If today's counts cannot be read, the call is refused (fails closed).
import { FEATURE_FLAGS } from './feature-flags';
import { aiCallDecision, rupeesFor, type ProviderName } from './spend-limits';
import { createServerClient } from './supabase';

/** The UTC day the counter is keyed by. */
export function usageDay(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export async function guardAiCall(provider: ProviderName, now: Date = new Date()): Promise<{ allowed: boolean; reason: string | null }> {
  if (!FEATURE_FLAGS.aiSpendGuardPilot) return { allowed: true, reason: null };
  const { data, error } = await createServerClient()
    .from('ai_model_usage')
    .select('calls, input_tokens, output_tokens, rupees')
    .eq('day', usageDay(now))
    .eq('provider', provider);
  if (error) return { allowed: false, reason: 'usage unreadable' };
  const used = { calls: 0, tokens: 0, rupees: 0 };
  for (const r of data ?? []) {
    used.calls += Number(r.calls);
    used.tokens += Number(r.input_tokens) + Number(r.output_tokens);
    used.rupees += Number(r.rupees);
  }
  const d = aiCallDecision(provider, used);
  return { allowed: d.allowed, reason: d.allowed ? null : `${provider} daily limit reached` };
}

/** Records one call. Rupees come from the model's price; an unpriced model records zero rupees (caps only). */
export async function recordAiCall(provider: ProviderName, model: string, inputTokens: number, outputTokens: number, now: Date = new Date()): Promise<void> {
  if (!FEATURE_FLAGS.aiSpendGuardPilot) return;
  const rupees = rupeesFor(model, inputTokens, outputTokens) ?? 0;
  const { error } = await createServerClient().rpc('ai_model_usage_add', {
    p_day: usageDay(now), p_provider: provider, p_model: model, p_input: inputTokens, p_output: outputTokens, p_rupees: rupees,
  });
  if (error) console.error('[spend-guard] count not recorded:', error.message);
}
