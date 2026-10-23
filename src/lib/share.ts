// Share registry and channel links. Pure: no browser, no network, no AI.
// Every Lab tool in lab-tools.ts carries share settings; Minifig HQ is registered here.
// Shared content is the page title and its link only. No name, email, account detail, browser data or rupee value.

import { LAB_TOOLS } from '@/lib/lab-tools';

export const SHARE_CHANNELS = ['whatsapp', 'facebook', 'instagram', 'email', 'copy'] as const;
export type ShareChannel = (typeof SHARE_CHANNELS)[number];

export type ShareTarget = {
  id: string;        // closed list: the analytics 'tool' parameter takes only these ids
  title: string;     // shared as the line of text
  path: string;      // page-link fallback: the page's own path
  pageType: string;  // the analytics 'page_type' value (must be in PAGE_TYPES)
};

// Approved visible text (owner, 23 Oct 2026). Use exactly these strings.
export const SHARE_TEXT = {
  button: 'Time to blow your trumpet',
  sheetTitle: 'Pick where to send it.',
  previewCaption: 'Can you feel it',
  copied: 'Awesomeness is loading',
  instagramFallback: 'Save the card, add it to your story. Time to make the world jealous',
  failureGeneral: 'That did not go through. Your list is still safe. Try again, or copy the link.',
  failureNoApp: 'Nothing opened. Copy the link and send it yourself.',
} as const;

/** Pure: the control shows only when the share flag is explicitly true. */
export function shareEnabled(flags: { shareEnabled: boolean }): boolean {
  return flags.shareEnabled === true;
}

const MINIFIG_HQ: ShareTarget = { id: 'minifig-hq', title: 'Minifig HQ', path: '/minifig-hq', pageType: 'minifig_hq' };

/** Every shareable page: live Lab tools with a page, and Minifig HQ. Community and coming-soon tools have no tool page here. */
export const SHARE_TARGETS: ShareTarget[] = [
  ...LAB_TOOLS.filter((t) => t.href !== null && t.id !== 'community').map((t) => ({
    id: t.id,
    title: t.name,
    path: t.href as string,
    pageType: 'lab',
  })),
  MINIFIG_HQ,
];

export const SHARE_TARGET_IDS: readonly string[] = SHARE_TARGETS.map((t) => t.id);

/** Pure: the target for a path, or null. /lab/cmf-tracker redirects to /minifig-hq and is not registered. */
export function targetForPath(pathname: string): ShareTarget | null {
  const clean = pathname.replace(/\/$/, '') || '/';
  return SHARE_TARGETS.find((t) => t.path === clean) ?? null;
}

/**
 * Pure: the link a channel opens, or null where the channel has no link form.
 * whatsapp and facebook open a web page. email opens the visitor's own mail app; the site sends nothing.
 * instagram and copy have no link form (copy uses the clipboard; instagram uses the phone's share sheet with an image).
 */
export function channelLink(channel: ShareChannel, title: string, url: string): string | null {
  const text = `${title} ${url}`;
  switch (channel) {
    case 'whatsapp':
      return `https://wa.me/?text=${encodeURIComponent(text)}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
    case 'email':
      return `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(url)}`;
    case 'instagram':
    case 'copy':
      return null;
  }
}
