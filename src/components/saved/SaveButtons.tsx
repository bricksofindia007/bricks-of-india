'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { useAccountSession } from '@/components/saved/AccountSession';
import {
  CHANGED_EVENT, COLLECTION_KEY, WISHLIST_KEY, VOICE, addOwned, addWish, cleanCollection, cleanWishlist, loadCollection,
  loadWishlist, removeWish, setOwnedQty, trackCollectionEvent, updateList, type SetRef,
} from '@/lib/my-collection';

// Re-read when any button on the page, or another tab, changes the lists.
function useLists() {
  const [, setTick] = useState(0);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    setReady(true);
    const bump = () => setTick((t) => t + 1);
    window.addEventListener(CHANGED_EVENT, bump);
    window.addEventListener('storage', bump);
    return () => { window.removeEventListener(CHANGED_EVENT, bump); window.removeEventListener('storage', bump); };
  }, []);
  return { ready };
}

/** Heart on a set card or set page. Saved in this browser only. */
export function HeartButton({ size = 'sm', ...ref }: SetRef & { size?: 'sm' | 'lg' }) {
  const { set, name } = ref;
  const { ready } = useLists();
  const [note, setNote] = useState<string | null>(null);
  const saved = ready && loadWishlist().some((w) => w.set === set);

  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(null), 5000);
    return () => clearTimeout(t);
  }, [note]);

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault(); // the card around it is a link
    e.stopPropagation();
    // Read, change and write in one step, so another tab's change is kept.
    const now = new Date().toISOString();
    const out = updateList(WISHLIST_KEY, cleanWishlist, (list) => {
      if (list.some((w) => w.set === set)) return { list: removeWish(list, set), result: 'removed' as const, changed: true };
      const r = addWish(list, ref, now);
      if (r.status === 'added') return { list: r.list, result: 'added' as const, changed: true };
      return { list, result: r.status as 'limit' | 'present', changed: false };
    });
    if (!out.ok || out.result === null) return; // storage refused: say nothing, so the page never claims a save
    if (out.result === 'limit') return setNote(VOICE.limitReached);
    if (out.result === 'removed') {
      trackCollectionEvent('heart_remove', { page_type: 'sets_list', set_number: set });
      setNote(VOICE.heartRemoved);
    } else if (out.result === 'added') {
      trackCollectionEvent('heart_add', { page_type: 'sets_list', set_number: set });
      setNote(VOICE.heartAdded);
    }
  };

  const dim = size === 'lg' ? 'w-11 h-11 text-2xl' : 'w-8 h-8 text-lg';
  return (
    <span className="relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        aria-label={saved ? `Remove ${name} from your wishlist` : `Save ${name} to your wishlist`}
        className={`${dim} inline-flex items-center justify-center rounded-full bg-white/90 border border-border shadow-sm hover:border-primary transition-colors ${saved ? 'text-red-600' : 'text-gray-400'}`}
      >
        <span aria-hidden="true">{saved ? '♥' : '♡'}</span>
      </button>
      {note && size !== 'lg' && <span role="status" className="sr-only">{note}</span>}
      {note && size === 'lg' && (
        <span role="status" className="absolute left-0 top-full mt-1 z-10 whitespace-nowrap text-xs text-gray-600 bg-white border border-border rounded px-2 py-1 shadow-sm">
          {note} <Link href="/my" className="underline">See your list</Link>
        </span>
      )}
    </span>
  );
}

/** "Add to my collection" on a set page, with copies once it is there. */
export function AddToCollectionButton(ref: SetRef) {
  const { set } = ref;
  const { ready } = useLists();
  // A signed-out visitor is asked to sign up (accounts on). Nothing is added to the browser list for them.
  const session = useAccountSession();
  const askForAccount = FEATURE_FLAGS.accountsEnabled && session === 'signed-out';
  const [note, setNote] = useState<string | null>(null);
  const qty = ready ? (loadCollection().find((o) => o.set === set)?.qty ?? 0) : 0;

  const change = (q: number) => {
    updateList(COLLECTION_KEY, cleanCollection, (list) => ({ list: setOwnedQty(list, set, q), result: null, changed: true }));
  };

  const add = () => {
    if (askForAccount) return;
    const now = new Date().toISOString();
    const out = updateList(COLLECTION_KEY, cleanCollection, (list) => {
      const r = addOwned(list, ref, now);
      if (r.status === 'added') return { list: r.list, result: 'added' as const, changed: true };
      return { list, result: r.status as 'limit' | 'present', changed: false };
    });
    if (!out.ok || out.result === null) return;
    if (out.result === 'limit') return setNote(VOICE.limitReached);
    if (out.result === 'added') {
      trackCollectionEvent('owned_add', { page_type: 'set', set_number: set });
      setNote(VOICE.ownedAdded);
    }
  };

  if (qty === 0 && askForAccount) {
    return <span className="text-sm text-gray-600">{VOICE.guestAddNote}</span>;
  }
  if (qty === 0) {
    return (
      <span className="inline-flex flex-col gap-1">
        <button type="button" onClick={add} className="text-sm font-semibold px-3 py-2 rounded-lg border border-border hover:border-primary">
          Add to my collection
        </button>
        {note && <span role="status" className="text-xs text-gray-600">{note}</span>}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span className="font-semibold">In My Collection</span>
      <button type="button" aria-label={`One fewer copy of ${ref.name}`} onClick={() => change(qty - 1)} className="w-7 h-7 rounded border border-border">−</button>
      <span aria-live="polite">{qty}</span>
      <button type="button" aria-label={`One more copy of ${ref.name}`} onClick={() => change(qty + 1)} className="w-7 h-7 rounded border border-border">+</button>
    </span>
  );
}
