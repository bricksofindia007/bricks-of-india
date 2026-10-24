'use client';

// The human-check widget for the admin sign-in form. Renders nothing while the flag is off.
import Script from 'next/script';
import { FEATURE_FLAGS } from '@/lib/feature-flags';
import { turnstileRequired, TURNSTILE_SITE_KEY_NAME } from '@/lib/turnstile';

export function TurnstileWidget() {
  if (!turnstileRequired(FEATURE_FLAGS)) return null;
  const siteKey = process.env[TURNSTILE_SITE_KEY_NAME];
  if (!siteKey) return null; // without a site key the widget cannot run; the server then refuses sign-in (fails closed)
  return (
    <>
      <Script src="https://challenges.cloudflare.com/turnstile/v0/api.js" strategy="afterInteractive" />
      <div className="cf-turnstile" data-sitekey={siteKey} style={{ marginBottom: 12 }} />
    </>
  );
}
