import type { Provider, ProviderCallInput, ProviderCallResult } from './types';

const CEREBRAS_MODEL   = 'gpt-oss-120b'; // proven free-tier model; llama-3.3-70b is not available on free tier
const CEREBRAS_API_URL = 'https://api.cerebras.ai/v1/chat/completions';

export class CerebrasProvider implements Provider {
  readonly name = 'cerebras';

  constructor(private readonly apiKey: string) {}

  async call({ systemPrompt, userPrompt }: ProviderCallInput): Promise<ProviderCallResult> {
    const body = JSON.stringify({
      model: CEREBRAS_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userPrompt   },
      ],
      max_tokens:  8192,  // reasoning model burns tokens on chain-of-thought before content; 2000 truncates
      temperature: 0.7,
    });

    const attempt = () => fetch(CEREBRAS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body,
      signal: AbortSignal.timeout(60_000),
    });
    let res = await attempt();

    // Single 429 retry
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 5000));
      res = await attempt();
    }

    if (!res.ok) {
      const text       = await res.text().catch(() => '');
      const err        = new Error(`Cerebras ${res.status}: ${text.slice(0, 200)}`);
      (err as any).retryable  = res.status === 429 || res.status >= 500;
      (err as any).statusCode = res.status;
      throw err;
    }

    const json = await res.json() as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content;
    if (!text) throw new Error('Cerebras: empty response content');
    return { text };
  }
}
