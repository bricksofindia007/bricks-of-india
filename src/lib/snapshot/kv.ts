// The site Worker's read-only binding to the snapshot namespace (FP1.1 §9:
// BOI_SNAPSHOTS, bound in wrangler.jsonc once the namespace exists, #263).
// null outside the Worker (next dev, tests, builds) or while unbound, and the
// reader then reports no-binding and the page uses the Supabase path.
import type { KvLike } from './reader';

export async function snapshotKv(): Promise<KvLike | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const { env } = await getCloudflareContext({ async: true });
    return ((env as unknown as Record<string, unknown>).BOI_SNAPSHOTS as KvLike | undefined) ?? null;
  } catch {
    return null;
  }
}
