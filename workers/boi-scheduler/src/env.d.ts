// Minimal Cloudflare Workers runtime types used by boi-scheduler (kept local so the site's
// tsconfig, which excludes workers/, doesn't need @cloudflare/workers-types).
interface KVNamespace {
  get(key: string): Promise<string | null>;
  get(key: string, type: 'json'): Promise<unknown>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}
interface ScheduledController { scheduledTime: number; cron: string }
interface ExecutionContext { waitUntil(p: Promise<unknown>): void }
