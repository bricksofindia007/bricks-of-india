import { MODEL_CONFIG } from '../prompts/draft-prompt';
import type { Provider, ProviderCallInput, ProviderCallResult } from './types';

export class GeminiProvider implements Provider {
  readonly name = 'gemini';

  constructor(private readonly apiKey: string) {}

  async call({ systemPrompt, userPrompt }: ProviderCallInput): Promise<ProviderCallResult> {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genai  = new GoogleGenerativeAI(this.apiKey);
    const result = await genai
      .getGenerativeModel({ model: MODEL_CONFIG.model, systemInstruction: systemPrompt })
      .generateContent({
        contents         : [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig : { temperature: MODEL_CONFIG.temperature, maxOutputTokens: MODEL_CONFIG.maxOutputTokens },
      });
    const usage = result.response.usageMetadata;
    return { text: result.response.text(), inputTokens: usage?.promptTokenCount, outputTokens: usage?.candidatesTokenCount };
  }
}
