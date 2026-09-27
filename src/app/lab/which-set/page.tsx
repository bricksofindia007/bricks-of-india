import { WhichSet } from './WhichSet';
import { getStores } from '@/lib/stores';

// FP5.1: the quiz UI is a client component (WhichSet.tsx); this server page
// only reads the retailer registry for the "Where to buy in India" links.
export default async function WhichSetPage() {
  const stores = (await getStores()).map((s) => ({ name: s.name, url: s.site_url, note: s.affiliate_note }));
  return <WhichSet stores={stores} />;
}
