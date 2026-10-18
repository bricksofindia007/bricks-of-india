// The log-out-everywhere control, as rendered on the server: the button text, the signed field, and the error an
// admin reads when the sessions could not be ended. Success never shows an error.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { LogoutEverywhereView } from '../src/app/admin/pending/LogoutEverywhereView';

const noop = (_: FormData) => undefined;
const text = (html: string) => html.replace(/<[^>]+>/g, '');
const FAILED = 'Sessions could not be ended. Nothing has changed. Try again.';

describe('the log-out-everywhere control, as rendered', () => {
  it('shows the button with its label, and no error before anything is tried', () => {
    const html = renderToStaticMarkup(<LogoutEverywhereView action={noop} state={null} />);
    expect(html).toContain('Log out everywhere');
    expect(html).not.toContain('role="alert"');
  });

  it('carries the signed field it was given, inside the form it submits', () => {
    const html = renderToStaticMarkup(
      <LogoutEverywhereView action={noop} state={null}>
        <input type="hidden" name="csrf" value="sig" />
      </LogoutEverywhereView>,
    );
    expect(html).toMatch(/<form[^>]*>[\s\S]*<input[^>]*name="csrf"[^>]*value="sig"[\s\S]*<\/form>/);
  });

  it('a failed revoke shows the error as an alert, with the exact approved wording', () => {
    const html = renderToStaticMarkup(<LogoutEverywhereView action={noop} state={{ error: FAILED }} />);
    expect(html).toContain('role="alert"');
    expect(text(html)).toContain(FAILED);
  });

  it('the error never reads as a sign-out', () => {
    const html = renderToStaticMarkup(<LogoutEverywhereView action={noop} state={{ error: FAILED }} />);
    expect(text(html)).not.toMatch(/signed out|logged out|ended everywhere/i);
  });

  it('while the request is running the button is disabled, and no error is shown from an earlier try', () => {
    const html = renderToStaticMarkup(<LogoutEverywhereView action={noop} state={null} pending={true} />);
    expect(html).toContain('disabled');
    expect(html).not.toContain('role="alert"');
  });
});
