import { WhichSet } from './WhichSet';
import { getStores } from '@/lib/stores';

// P10 revalidate audit (29 Sep): this route had no revalidate of its own and was either built
// once per deploy (its data froze between deploys) or refreshed only as a side effect of a shared
// read. Its cadence is now explicit and checked in CI.
export const revalidate = 3600; // = READ_REVALIDATE_SECONDS (src/lib/route-cadence.ts; segment config must be a literal)

// FP5.1: the quiz UI is a client component (WhichSet.tsx); this server page
// only reads the retailer registry for the "Where to buy in India" links.
export default async function WhichSetPage() {
  const stores = (await getStores()).map((s) => ({ name: s.name, url: s.site_url, note: s.affiliate_note }));
  return <WhichSet stores={stores} />;
}
