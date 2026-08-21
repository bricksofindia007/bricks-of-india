import type { Provider, ProviderCallInput, ProviderCallResult } from './types';

// Added 2026-08-19: new default Gemini fallback, replacing Cerebras (see
// feature-flags.ts's 'cerebrasFallbackEnabled' for why -- Cerebras has been
// payment-blocked, 402, since 2026-08-18, and Abhinav cannot add a payment
// method to that account). Groq's free tier fails with 429 on rate-limit
// (30 RPM / 6,000 TPM / 14,400 RPD per org), not a permanent-until-paid 402
// -- isRetryableGeminiError-style 429 handling in generate-with-failover.ts
// already covers this shape.
const GROQ_MODEL   = 'llama-3.3-70b-versatile';
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

export class GroqProvider implements Provider {
  readonly name = 'groq';

  constructor(private readonly apiKey: string) {}

  async call({ systemPrompt, userPrompt }: ProviderCallInput): Promise<ProviderCallResult> {
    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
        max_tokens:  2048,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const err  = new Error(`Groq ${res.status}: ${text.slice(0, 200)}`);
      (err as any).retryable  = res.status === 429 || res.status >= 500;
      (err as any).statusCode = res.status;
      throw err;
    }

    const json = await res.json() as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = json.choices?.[0]?.message?.content;
    if (!text) throw new Error('Groq: empty response content');
    return { text, inputTokens: json.usage?.prompt_tokens, outputTokens: json.usage?.completion_tokens };
  }
}
