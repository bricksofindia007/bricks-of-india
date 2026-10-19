// Accessibility of the My Collection pieces, checked on the server-rendered markup (react-dom/server): button names,
// alert and status roles, the tab and panel links, one main heading, and the order of the regions.
// Rows and list items only exist after the browser loads them, so their labels are checked on the source as well.
import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const flags = vi.hoisted(() => ({ myCollectionPage: true, myCollectionHearts: true }));
vi.mock('../src/lib/feature-flags', () => ({ FEATURE_FLAGS: flags }));
vi.mock('next/navigation', () => ({ notFound: () => { throw new Error('NEXT_NOT_FOUND'); } }));

import { HeartButton, AddToCollectionButton } from '../src/components/saved/SaveButtons';
import { PricesUnavailable } from '../src/app/my/PriceNotes';
import { MyCollection } from '../src/app/my/MyCollection';
import MyPage from '../src/app/my/page';

const root = join(__dirname, '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');
const SET = { set: '10307', name: 'Eiffel Tower', image_url: null, pieces: 10001, theme: 'Icons', year: 2023 };
const attr = (html: string, tag: string) => [...html.matchAll(new RegExp(`<${tag}\\b[^>]*>`, 'g'))].map((m) => m[0]);

describe('the heart and the add button have names a screen reader can use', () => {
  it('the heart is a named button; the name says the action', () => {
    const html = renderToStaticMarkup(<HeartButton {...SET} />);
    const [btn] = attr(html, 'button');
    expect(btn).toContain('type="button"');
    expect(btn).toContain('aria-label="Save Eiffel Tower to your wishlist"');
  });
  it('the heart does not also claim a pressed state, so the name is the only state', () => {
    const html = renderToStaticMarkup(<HeartButton {...SET} />);
    expect(html).not.toContain('aria-pressed');
  });
  it('the add button is named by its text', () => {
    const html = renderToStaticMarkup(<AddToCollectionButton {...SET} />);
    expect(html).toContain('>Add to my collection</button>');
  });
});

describe('alerts and the status regions', () => {
  it('the unavailable banner is an alert', () => {
    const html = renderToStaticMarkup(<PricesUnavailable />);
    expect(html).toMatch(/<p role="alert"[^>]*>Prices are unavailable right now\. Names and pieces are still shown\.<\/p>/);
  });
  it('the small heart reports its feedback in a status region, even though it is not visible', () => {
    const src = read('src/components/saved/SaveButtons.tsx');
    expect(src).toContain('<span role="status" className="sr-only">{note}</span>');
  });
  it('the large heart keeps its visible status region', () => {
    const src = read('src/components/saved/SaveButtons.tsx');
    expect(src).toMatch(/<span role="status" className="absolute[^"]*">/);
  });
});

describe('the My Collection page structure', () => {
  const html = renderToStaticMarkup(<MyCollection />);

  it('the tabs are linked to the panel they control, and the panel names its tab', () => {
    const tabs = attr(html, 'button').filter((b) => b.includes('role="tab"'));
    expect(tabs).toHaveLength(2);
    expect(tabs[0]).toContain('id="tab-wish"');
    expect(tabs[0]).toContain('aria-controls="collection-panel"');
    expect(tabs[1]).toContain('id="tab-owned"');
    const panel = attr(html, 'div').find((d) => d.includes('role="tabpanel"'));
    expect(panel).toContain('id="collection-panel"');
    expect(panel).toContain('aria-labelledby="tab-wish"');
  });
  it('the tab list is labelled by its role and has exactly two tabs', () => {
    expect(html).toContain('role="tablist"');
    expect((html.match(/role="tab"/g) ?? []).length).toBe(2);
  });
  it('the summary is a description list with a label per figure', () => {
    expect(html).toMatch(/<dl[^>]*>/);
    for (const label of ['Sets saved', 'Sets in collection', 'Total pieces', 'Total worth', 'Retired, not valued']) {
      expect(html).toContain(`>${label}</dt>`);
    }
  });
  it('the regions appear in the reading order: the show filter, the summary, the tabs, then the list', () => {
    const at = (s: string) => html.indexOf(s);
    expect(at('role="group" aria-label="Show"')).toBeGreaterThan(-1);
    expect(at('role="group" aria-label="Show"')).toBeLessThan(at('<dl'));
    expect(at('<dl')).toBeLessThan(at('role="tablist"'));
    expect(at('role="tablist"')).toBeLessThan(at('id="collection-panel"'));
  });
  it('the loading placeholder is hidden from assistive tech', () => {
    expect(html).toContain('aria-hidden="true"');
  });
});

describe('the page has one main heading', () => {
  it('the My Collection page renders exactly one h1, with the page name', () => {
    const html = renderToStaticMarkup(<MyPage />);
    expect((html.match(/<h1\b/g) ?? []).length).toBe(1);
    expect(html).toMatch(/<h1[^>]*>My Collection<\/h1>/);
  });
});

describe('row labels (checked on the source; rows render only after the browser loads them)', () => {
  it('the wishlist remove button names the set', () => {
    expect(read('src/app/my/MyCollection.tsx')).toContain('aria-label={`Remove ${w.name} from your wishlist`}');
  });
  it('the quantity buttons name the set they change', () => {
    const src = read('src/app/my/MyCollection.tsx');
    expect(src).toContain('aria-label={`One fewer ${o.name}`}');
    expect(src).toContain('aria-label={`One more ${o.name}`}');
  });
  it('the set-page quantity buttons name the set', () => {
    const src = read('src/components/saved/SaveButtons.tsx');
    expect(src).toContain('aria-label={`One fewer copy of ${ref.name}`}');
    expect(src).toContain('aria-label={`One more copy of ${ref.name}`}');
  });
  it('the figure remove button names the figure', () => {
    expect(read('src/app/my/FiguresList.tsx')).toContain('aria-label={`Remove ${f.name} from your saved figures`}');
  });
  it('each set picture is labelled by the set name', () => {
    expect(read('src/components/sets/SetImage.tsx')).toMatch(/alt=\{set\.name\}/);
  });
});
