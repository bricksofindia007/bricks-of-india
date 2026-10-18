import { PRIVACY_SECTIONS, TERMS_SECTIONS } from '@/lib/legal-copy';

// Rendered by /legal/privacy and /legal/terms only when the accounts flag is on.
export function PrivacyNotice() {
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-heading text-dark text-5xl mb-8">Privacy notice</h1>
        <div className="font-body space-y-6 text-gray-600 leading-relaxed">
          {PRIVACY_SECTIONS.map((s) => (
            <p key={s.lead}>
              <strong className="text-dark">{s.lead}</strong> {s.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TermsNotice() {
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-heading text-dark text-5xl mb-8">Terms of use</h1>
        <div className="font-body space-y-6 text-gray-600 leading-relaxed">
          {TERMS_SECTIONS.map((s) => (
            <p key={s.lead}>
              <strong className="text-dark">{s.lead}</strong> {s.text}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
