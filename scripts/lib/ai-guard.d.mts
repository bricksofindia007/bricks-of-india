export type AiBudget = {
  name: string; maxCalls: number; maxInputTokens: number;
  calls: number; inputTokens: number; outputTokens: number;
  models: Record<string, number>; alerted: boolean;
  alert: (subject: string, body: string) => Promise<void> | void;
};
export class AiLimitError extends Error {}
export function estimateTokens(text: string | null | undefined): number;
export function createBudget(opts?: { runName?: string; scope?: 'request'; alert?: AiBudget['alert'] }): AiBudget;
export function runBudget(opts?: { runName?: string; scope?: 'request'; alert?: AiBudget['alert'] }): AiBudget;
export function summary(budget: AiBudget): { run: string; calls: number; inputTokens: number; outputTokens: number; models: Record<string, number> };
export function guardedCall<T extends { inputTokens?: number; outputTokens?: number }>(args: {
  site: 'draft' | 'caption' | 'video' | 'canary'; model: string; system: string; user: string;
  invoke: () => Promise<T>; budget: AiBudget;
}): Promise<T>;
export function reportAtExit(budget: AiBudget): void;
export function geminiUsage(result: { response: { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } } }): { inputTokens?: number; outputTokens?: number };
