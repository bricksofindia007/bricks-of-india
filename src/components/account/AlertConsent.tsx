import { ALERT_CONSENT_TEXT } from '@/lib/legal-copy';

// Shown where the visitor switches alerts on.
export function AlertConsent({ name = 'alerts_consent' }: { name?: string }) {
  return (
    <label className="font-body text-sm text-dark flex items-start gap-2">
      <input type="checkbox" name={name} required className="mt-1" />
      <span>{ALERT_CONSENT_TEXT}</span>
    </label>
  );
}
