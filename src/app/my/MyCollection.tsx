'use client';

import { FiguresList } from './FiguresList';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SetImage } from '@/components/sets/SetImage';
import { slugify } from '@/lib/utils';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import type { LastSeen } from '@/lib/collection-worth';
import { lastSeenMap, retiredIdsForLastSeen } from '@/lib/last-seen-page';
import { AccountSessionProvider, useAccountSession } from '@/components/saved/AccountSession';
import {
  CHANGED_EVENT, COLLECTION_KEY, WISHLIST_KEY, VOICE, cleanCollection, cleanWishlist, loadCollection, loadWishlist, pageOf,
  priceIds, removeWish, setOwnedQty, trackCollectionEvent, updateList, type OwnedItem, type WishItem,
} from '@/lib/my-collection';
import {
  worthOf, worthTotal, usableRate, formatRs, worthInputFor, WISHLIST_NO_PRICE_LINE, type StoredRate, type WorthItem,
} from '@/lib/collection-worth';
import { rateSourceOf } from '@/lib/usd-rate-reader';
import { OwnedWorthLine, PricesUnavailable, TotalWorthValue, WishPrice } from './PriceNotes';
import { CollectionShare } from '@/components/share/CollectionShare';
import { nextTab } from './tab-keys';

// The stored exchange rate arrives with the price read, server side. Missing, stale (over 5 days) or out-of-band rates
// mean no estimate is shown. Retired status comes from the price read (sets.retired); it is unknown, and so never
// treated as retired, until that read succeeds.

type Price = {
  set_number: string;
  best_price_inr: number | null;
  best_store_ids: string[] | null;
  us_price_usd: number | null;
  stored_estimate_inr: number | null;
  retired: boolean | null;
};
type Tab = 'wish' | 'owned';
type PriceState = 'loading' | 'ok' | 'failed';

function Skeleton() {
  return (
    <ul aria-hidden="true" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 6 }, (_, i) => (
        <li key={i} className="border border-border rounded-xl p-3 flex gap-3 animate-pulse">
          <div className="w-20 h-20 shrink-0 bg-surface rounded" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-3 bg-surface rounded w-1/3" />
            <div className="h-4 bg-surface rounded w-3/4" />
            <div className="h-3 bg-surface rounded w-1/2" />
          </div>
        </li>
      ))}
    </ul>
  );
}

function Pager({ page, pages, onChange }: { page: number; pages: number; onChange: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav className="flex items-center gap-3 mt-6 text-sm" aria-label="Pages">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)} className="px-3 py-1 rounded border border-border disabled:opacity-40">Previous</button>
      <span>Page {page} of {pages}</span>
      <button type="button" disabled={page >= pages} onClick={() => onChange(page + 1)} className="px-3 py-1 rounded border border-border disabled:opacity-40">Next</button>
    </nav>
  );
}

// The page reads the session once (through the shared provider), and only while accounts are on.
export function MyCollection() {
  return (
    <AccountSessionProvider enabled={FEATURE_FLAGS.accountsEnabled}>
      <MyCollectionView />
    </AccountSessionProvider>
  );
}

function MyCollectionView() {
  const session = useAccountSession();
  const [ready, setReady] = useState(false);
  const [wish, setWish] = useState<WishItem[]>([]);
  const [owned, setOwned] = useState<OwnedItem[]>([]);
  const [tab, setTab] = useState<Tab>('wish');
  const [wishPage, setWishPage] = useState(1);
  const [ownedPage, setOwnedPage] = useState(1);
  const [priceState, setPriceState] = useState<PriceState>('loading');
  const [kind, setKind] = useState<'sets' | 'figures'>('sets');
  const [prices, setPrices] = useState<Map<string, Price>>(new Map());
  const [storeNames, setStoreNames] = useState<Record<string, string>>({});
  const [storedRate, setStoredRate] = useState<StoredRate | null>(null);

  // Load the lists from this browser and follow changes made elsewhere on the page or in another tab.
  useEffect(() => {
    const load = () => { setWish(loadWishlist()); setOwned(loadCollection()); };
    load();
    setReady(true);
    trackCollectionEvent('my_sets_view', { page_type: 'sets_list' });
    window.addEventListener(CHANGED_EVENT, load);
    window.addEventListener('storage', load);
    return () => { window.removeEventListener(CHANGED_EVENT, load); window.removeEventListener('storage', load); };
  }, []);

  // One batched price read per page view, capped. A failure keeps names and pieces and says so.
  const ids = useMemo(() => priceIds(wish, owned).join(','), [wish, owned]);
  useEffect(() => {
    if (!ready) return;
    if (!ids) { setPriceState('ok'); setPrices(new Map()); setStoredRate(null); return; }
    let live = true;
    setPriceState('loading');
    fetch(`/api/saved-sets?ids=${encodeURIComponent(ids)}`)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((j: { sets: Price[]; store_names: Record<string, string>; usd_inr?: StoredRate | null }) => {
        if (!live) return;
        setPrices(new Map(j.sets.map((s) => [s.set_number, s])));
        setStoreNames(j.store_names ?? {});
        setStoredRate(j.usd_inr ?? null);
        setPriceState('ok');
      })
      .catch(() => { if (live) { setStoredRate(null); setPriceState('failed'); } });
    return () => { live = false; };
  }, [ready, ids]);

  // Retired status is known only after the price read succeeds. Unknown counts as not retired, so no retired line is guessed.
  const isRetired = (set: string): boolean | null => (priceState === 'ok' ? prices.get(set)?.retired ?? null : null);

  // Retired owned sets show their last seen price on the row. One batched read, only for those sets. A failure keeps the
  // approved retired line. The total does not change (the last seen price is not added to it).
  const [lastSeen, setLastSeen] = useState<Map<string, NonNullable<LastSeen>>>(new Map());
  const retiredIds = useMemo(() => retiredIdsForLastSeen(owned, isRetired), [owned, priceState, prices]);
  const retiredKey = retiredIds.join(',');
  useEffect(() => {
    if (!ready || retiredKey === '') { setLastSeen(new Map()); return; }
    let live = true;
    fetch(`/api/last-seen-prices?ids=${encodeURIComponent(retiredKey)}`)
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then((j: { prices?: { set_number: string; price_inr: number; observed_at: string }[] }) => {
        if (live) setLastSeen(lastSeenMap(j.prices ?? []));
      })
      .catch(() => { if (live) setLastSeen(new Map()); });
    return () => { live = false; };
  }, [ready, retiredKey]);

  const rate = usableRate(rateSourceOf(storedRate).getRate(), new Date());
  const worthItems: WorthItem[] = owned.map((o) => worthInputFor(o, prices.get(o.set), priceState === 'ok'));
  // The price read covers the newest sets only; a collection set it leaves out is capped out of the total.
  const pricedIds = new Set(priceIds(wish, owned));
  const capped = owned.some((o) => !pricedIds.has(o.set));
  const total = worthTotal(worthItems, rate, isRetired, capped);
  const pieces = owned.reduce((n, o) => n + (o.pieces ?? 0) * o.qty, 0);
  const piecesMissing = owned.some((o) => o.pieces == null);


  // Each change reads the stored list at the moment of writing (not the page state), so another tab's change is kept.
  const removeFromWish = (set: string) => {
    const out = updateList(WISHLIST_KEY, cleanWishlist, (list) => ({
      list: removeWish(list, set), result: null, changed: list.some((w) => w.set === set),
    }));
    if (out.ok) trackCollectionEvent('heart_remove', { page_type: 'sets_list', set_number: set });
  };
  const changeQty = (set: string, q: number) =>
    updateList(COLLECTION_KEY, cleanCollection, (list) => ({ list: setOwnedQty(list, set, q), result: null, changed: true })).ok;

  const wishPaged = pageOf(wish, wishPage);
  const ownedPaged = pageOf(owned, ownedPage);

  const filterBar = (
    <div role="group" aria-label="Show" className="flex gap-2 mb-6">
      <button type="button" aria-pressed={kind === 'sets'} onClick={() => setKind('sets')} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${kind === 'sets' ? 'bg-primary text-white' : 'border border-border'}`}>Sets</button>
      {FEATURE_FLAGS.myCollectionFigures && (
        <button type="button" aria-pressed={kind === 'figures'} onClick={() => setKind('figures')} className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${kind === 'figures' ? 'bg-primary text-white' : 'border border-border'}`}>Minifigures</button>
      )}
    </div>
  );

  // The Minifigures view is reachable only while its flag is on; with the flag off the sets view is always shown.
  if (kind === 'figures' && FEATURE_FLAGS.myCollectionFigures) {
    return (
      <div>
        {filterBar}
        <FiguresList />
      </div>
    );
  }

  return (
    <div>
      {filterBar}
      {/* Summary strip */}
      <dl className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 text-sm">
        <div className="border border-border rounded-lg p-3"><dt className="text-gray-500">Sets saved</dt><dd className="font-bold text-dark text-lg">{wish.length}</dd></div>
        <div className="border border-border rounded-lg p-3"><dt className="text-gray-500">Sets in collection</dt><dd className="font-bold text-dark text-lg">{owned.length}</dd></div>
        <div className="border border-border rounded-lg p-3">
          <dt className="text-gray-500">Total pieces</dt>
          <dd className="font-bold text-dark text-lg">{formatRs(pieces)}{piecesMissing ? '+' : ''}</dd>
        </div>
        <div className="border border-border rounded-lg p-3">
          <dt className="text-gray-500">Total worth</dt>
          <dd className="font-bold text-dark text-lg"><TotalWorthValue loading={priceState === 'loading'} inr={total.inr} estimates={total.estimate} /></dd>
        </div>
        <div className="border border-border rounded-lg p-3">
          <dt className="text-gray-500">Retired, not valued</dt>
          <dd className="font-bold text-dark text-lg">{total.retired}</dd>
        </div>
      </dl>
      {owned.length > 0 && priceState !== 'loading' && (
        <div className="text-xs text-gray-600 mb-4">
          <p>{total.line}</p>
          {total.rateNote && <p className="mt-1">{total.rateNote}</p>}
        </div>
      )}

      {priceState === 'failed' && <PricesUnavailable />}

      <div role="tablist" className="flex gap-2 mb-6" onKeyDown={(e) => {
          const next = nextTab(tab, e.key);
          if (!next) return;
          e.preventDefault();
          setTab(next);
          document.getElementById(`tab-${next}`)?.focus();
        }}>
        <button role="tab" id="tab-wish" tabIndex={tab === 'wish' ? 0 : -1} aria-controls="collection-panel" aria-selected={tab === 'wish'} onClick={() => setTab('wish')} className={`px-4 py-2 rounded-lg font-semibold ${tab === 'wish' ? 'bg-primary text-white' : 'border border-border'}`}>Wishlist ({wish.length})</button>
        <button role="tab" id="tab-owned" tabIndex={tab === 'owned' ? 0 : -1} aria-controls="collection-panel" aria-selected={tab === 'owned'} onClick={() => setTab('owned')} className={`px-4 py-2 rounded-lg font-semibold ${tab === 'owned' ? 'bg-primary text-white' : 'border border-border'}`}>My Collection ({owned.length})</button>
      </div>

      <div id="collection-panel" role="tabpanel" aria-labelledby={tab === 'wish' ? 'tab-wish' : 'tab-owned'}>
      {!ready && <Skeleton />}
      {ready && tab === 'wish' && <CollectionShare kind="wishlist" count={wish.length} />}
      {ready && tab === 'owned' && <CollectionShare kind="collection" count={owned.length} />}

      {ready && tab === 'wish' && FEATURE_FLAGS.accountsEnabled && session === 'signed-out' && (
        <p className="text-sm text-gray-600 mb-4">{VOICE.guestWishlistNote}</p>
      )}

      {ready && tab === 'wish' && (
        wish.length === 0 ? (
          <p className="text-gray-600">{VOICE.wishlistEmpty}</p>
        ) : (
          <>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {wishPaged.rows.map((w) => {
                const p = prices.get(w.set);
                return (
                  <li key={w.set} className="border border-border rounded-xl p-3 flex gap-3">
                    <Link href={`/sets/${w.set}-${slugify(w.name)}`} className="w-20 h-20 shrink-0 relative bg-surface rounded">
                      <SetImage set={{ set_number: w.set, image_url: w.image_url ?? null, name: w.name } as never} className="object-contain p-1" />
                    </Link>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="text-xs text-gray-600 font-price">{w.set}</p>
                      <p className="font-bold text-dark leading-tight line-clamp-2">{w.name}</p>
                      {w.pieces != null && <p className="text-xs text-gray-500">{formatRs(w.pieces)} pieces</p>}
                      {priceState === 'loading' && <p className="mt-1 h-3 w-24 bg-surface rounded animate-pulse" />}
                      <WishPrice priceReady={priceState === 'ok'} price={p?.best_price_inr ?? null} storeIds={p?.best_store_ids ?? null} storeNames={storeNames} />
                      <div className="mt-2 flex gap-3 text-xs">
                        <button type="button" aria-label={`Remove ${w.name} from your wishlist`} onClick={() => removeFromWish(w.set)} className="underline text-gray-500">Remove</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Pager page={wishPaged.page} pages={wishPaged.pages} onChange={setWishPage} />
          </>
        )
      )}

      {ready && tab === 'owned' && FEATURE_FLAGS.accountsEnabled && session === 'signed-out' && (
        <p className="text-sm text-gray-600 mb-4">{VOICE.guestCollectionNote}</p>
      )}

      {ready && tab === 'owned' && (
        owned.length === 0 ? (
          <p className="text-gray-600">{VOICE.collectionEmpty}</p>
        ) : (
          <>
            <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ownedPaged.rows.map((o) => {
                const p = prices.get(o.set);
                const w = worthOf(worthInputFor(o, p, priceState === 'ok'), rate, isRetired(o.set), lastSeen.get(o.set) ?? null);
                return (
                  <li key={o.set} className="border border-border rounded-xl p-3 flex gap-3">
                    <Link href={`/sets/${o.set}-${slugify(o.name)}`} className="w-20 h-20 shrink-0 relative bg-surface rounded">
                      <SetImage set={{ set_number: o.set, image_url: o.image_url ?? null, name: o.name } as never} className="object-contain p-1" />
                    </Link>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="text-xs text-gray-600 font-price">{o.set}</p>
                      <p className="font-bold text-dark leading-tight line-clamp-2">{o.name}</p>
                      {o.pieces != null && <p className="text-xs text-gray-500">{formatRs(o.pieces)} pieces</p>}
                      {priceState === 'loading' && <p className="mt-1 h-3 w-24 bg-surface rounded animate-pulse" />}
                      {priceState !== 'loading' && <OwnedWorthLine line={w.line} />}
                      {w.note && <p className="mt-1 text-xs text-gray-500">{w.note}</p>}
                      <div className="mt-2 flex items-center gap-2 text-xs">
                        <button type="button" aria-label={`One fewer ${o.name}`} onClick={() => changeQty(o.set, o.qty - 1)} className="w-7 h-7 rounded border border-border">−</button>
                        <span aria-live="polite">{o.qty}</span>
                        <button type="button" aria-label={`One more ${o.name}`} onClick={() => changeQty(o.set, o.qty + 1)} className="w-7 h-7 rounded border border-border">+</button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <Pager page={ownedPaged.page} pages={ownedPaged.pages} onChange={setOwnedPage} />
          </>
        )
      )}
      </div>
    </div>
  );
}
