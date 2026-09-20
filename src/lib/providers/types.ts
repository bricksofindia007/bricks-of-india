export type ProviderCallInput = {
  systemPrompt: string;
  userPrompt: string;
};

export type ProviderCallResult = {
  text: string;
  // Added 2026-08-19, optional -- not every provider/SDK path returns usage
  // data, and callers predating this change don't set it.
  inputTokens?: number;
  outputTokens?: number;
};

export interface Provider {
  readonly name: string;
  call(input: ProviderCallInput): Promise<ProviderCallResult>;
}
