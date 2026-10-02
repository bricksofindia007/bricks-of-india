// 2 Oct 2026: article bodies render markdown tables (Brick Rush list article).
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ArticleMarkdown } from '../src/components/content/ArticleMarkdown';

describe('ArticleMarkdown', () => {
  it('renders a markdown table as an HTML table inside a scroll wrapper', () => {
    const html = renderToStaticMarkup(<ArticleMarkdown>{'| Set | Name |\n|---|---|\n| 75419 | Death Star |'}</ArticleMarkdown>);
    expect(html).toContain('<table>');
    expect(html).toContain('<td>Death Star</td>');
    expect(html).toContain('overflow-x-auto');
    expect(html).not.toContain('| Set |');
  });
  it('plain paragraphs and links still render', () => {
    const html = renderToStaticMarkup(<ArticleMarkdown>{'See the [price page](/sets/75419-death-star).'}</ArticleMarkdown>);
    expect(html).toContain('<a href="/sets/75419-death-star">price page</a>');
  });
});
