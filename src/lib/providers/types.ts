export type ProviderCallInput = {
  systemPrompt: string;
  userPrompt: string;
};

export type ProviderCallResult = {
  text: string;
};

export interface Provider {
  readonly name: string;
  call(input: ProviderCallInput): Promise<ProviderCallResult>;
}
