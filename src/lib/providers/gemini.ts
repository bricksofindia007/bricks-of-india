import { MODEL_CONFIG } from '../prompts/draft-prompt';
import type { Provider, ProviderCallInput, ProviderCallResult } from './types';
import { guardAiCall, recordAiCall } from '../spend-guard-pilot';

export class GeminiProvider implements Provider {
  readonly name = 'gemini';

  constructor(private readonly apiKey: string) {}

  async call({ systemPrompt, userPrompt }: ProviderCallInput): Promise<ProviderCallResult> {
    // Pilot (flag off = no check, no count): refuse once today's Gemini limit is reached.
    const guard = await guardAiCall('gemini');
    if (!guard.allowed) throw new Error(`Gemini not called: ${guard.reason}`);
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genai  = new GoogleGenerativeAI(this.apiKey);
    const result = await genai
      .getGenerativeModel({ model: MODEL_CONFIG.model, systemInstruction: systemPrompt })
      .generateContent({
        contents         : [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig : { temperature: MODEL_CONFIG.temperature, maxOutputTokens: MODEL_CONFIG.maxOutputTokens },
      });
    const usage = result.response.usageMetadata;
    await recordAiCall('gemini', MODEL_CONFIG.model, usage?.promptTokenCount ?? 0, usage?.candidatesTokenCount ?? 0);
    return { text: result.response.text(), inputTokens: usage?.promptTokenCount, outputTokens: usage?.candidatesTokenCount };
  }
}
