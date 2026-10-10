// Safety limits for every Gemini call (JS/TS). Config: config/ai-limits.json.
// Every call goes through guardedCall(): model allowlist, per-call size, then per-run caps.
// A refused call throws before anything is sent. A cap hit sends one alert per run and throws.
// Usage is counts only (calls, input and output tokens, model names): no prompts, no keys.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sendAlert as defaultSendAlert } from './alert.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = JSON.parse(fs.readFileSync(path.join(here, '..', '..', 'config', 'ai-limits.json'), 'utf8'));

export class AiLimitError extends Error {
  constructor(message) { super(message); this.name = 'AiLimitError'; }
}

export function estimateTokens(text) {
  return Math.ceil(String(text ?? '').length / CONFIG.charsPerToken);
}

// One budget per run. scope 'request' makes a fresh one (web requests); otherwise one per process,
// keyed by the script name, so every call in a batch run counts against the same caps.
const processBudgets = new Map();

function limitsFor(runName, scope) {
  if (scope === 'request') return { name: 'request', ...CONFIG.requestScope };
  const found = CONFIG.perRun[runName];
  return { name: found ? runName : 'default', ...(found ?? CONFIG.perRun.default) };
}

export function createBudget({ runName = 'default', scope, alert = defaultSendAlert } = {}) {
  const lim = limitsFor(runName, scope);
  return {
    name: lim.name,
    maxCalls: lim.maxCalls,
    maxInputTokens: lim.maxInputTokens,
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    models: {},
    alerted: false,
    alert,
  };
}

export function runBudget(opts = {}) {
  if (opts.scope === 'request') return createBudget(opts);
  const key = opts.runName ?? path.basename(process.argv[1] || 'default');
  if (!processBudgets.has(key)) {
    const created = createBudget({ ...opts, runName: key });
    reportAtExit(created);
    processBudgets.set(key, created);
  }
  return processBudgets.get(key);
}

export function summary(budget) {
  return { run: budget.name, calls: budget.calls, inputTokens: budget.inputTokens, outputTokens: budget.outputTokens, models: { ...budget.models } };
}

async function refuse(budget, reason) {
  if (!budget.alerted) {
    budget.alerted = true;
    try {
      await budget.alert(
        `AI call limit hit: ${budget.name}`,
        `Run ${budget.name} stopped before a call: ${reason}. Calls so far: ${budget.calls}. Input tokens so far: ${budget.inputTokens}. Output tokens so far: ${budget.outputTokens}.`,
      );
    } catch (err) {
      console.error('[ai-guard] alert failed:', err?.message ?? err);
    }
  }
  throw new AiLimitError(reason);
}

// invoke() must return { text, inputTokens?, outputTokens? }. Its real usage is counted when given.
export async function guardedCall({ site, model, system, user, invoke, budget }) {
  if (!CONFIG.allowedModels.includes(model)) return refuse(budget, `model not on the allowlist: ${model}`);
  const siteLimit = CONFIG.sites[site];
  if (!siteLimit) return refuse(budget, `unknown call site: ${site}`);
  const est = estimateTokens(system) + estimateTokens(user);
  if (est > siteLimit.maxInputTokensPerCall) {
    return refuse(budget, `request too large for ${site}: about ${est} input tokens, limit ${siteLimit.maxInputTokensPerCall}`);
  }
  if (budget.calls + 1 > budget.maxCalls) return refuse(budget, `call cap reached: ${budget.maxCalls} calls per run`);
  if (budget.inputTokens + est > budget.maxInputTokens) {
    return refuse(budget, `input token cap reached: ${budget.maxInputTokens} per run`);
  }
  // Count the attempt before sending, so a failed request still counts against the caps.
  budget.calls += 1;
  budget.models[model] = (budget.models[model] ?? 0) + 1;
  budget.inputTokens += est;
  const res = await invoke();
  if (Number.isFinite(res?.inputTokens)) budget.inputTokens += res.inputTokens - est;
  if (Number.isFinite(res?.outputTokens)) budget.outputTokens += res.outputTokens;
  return res;
}

// Print counts once at process exit, for any run that made a call.
export function reportAtExit(budget) {
  process.once('exit', () => {
    if (budget.calls > 0) console.log(`[ai-usage] ${JSON.stringify(summary(budget))}`);
  });
}

// Usage from a Gemini SDK result ({ response }): counts only.
export function geminiUsage(result) {
  const u = result?.response?.usageMetadata;
  return { inputTokens: u?.promptTokenCount, outputTokens: u?.candidatesTokenCount };
}
