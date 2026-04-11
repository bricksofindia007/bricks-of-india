import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Privacy Policy | Bricks of India' };

export default function PrivacyPage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-heading text-dark text-5xl mb-2">PRIVACY POLICY</h1>
        <p className="text-gray-400 text-sm mb-8">Last updated: April 2026</p>
        <div className="font-body space-y-6 text-gray-600 leading-relaxed">
          <section><h2 className="font-heading text-dark text-2xl mb-3">ANALYTICS</h2><p>We use Google Analytics to collect anonymous visitor data including page views, session duration, and device type. This data is used solely to improve the website. No personally identifiable information is collected through analytics.</p></section>
          <section><h2 className="font-heading text-dark text-2xl mb-3">COOKIES</h2><p>This website uses cookies for analytics and site functionality. By continuing to use this website, you consent to the use of cookies in accordance with this policy. You can disable cookies in your browser settings, though some site features may not function correctly.</p></section>
          <section><h2 className="font-heading text-dark text-2xl mb-3">EMAIL NEWSLETTER</h2><p>If you subscribe to our newsletter, we collect your email address. This is used only to send Bricks of India updates, deals, and LEGO® news. We do not sell, rent, or share your email address with third parties. You can unsubscribe at any time using the link in any email we send.</p></section>
          <section><h2 className="font-heading text-dark text-2xl mb-3">DATA STORAGE</h2><p>Newsletter subscriber data is stored securely in Supabase (a PostgreSQL database hosted in the EU). We implement appropriate security measures to protect your data from unauthorized access.</p></section>
          <section><h2 className="font-heading text-dark text-2xl mb-3">THIRD PARTIES</h2><p>We do not sell personal data to third parties. Period. We barely have time to look after our own data, let alone someone else&apos;s.</p></section>
          <section><h2 className="font-heading text-dark text-2xl mb-3">YOUR RIGHTS</h2><p>You have the right to access, correct, or delete your personal data held by us. To exercise these rights, contact us via the contact page. We comply with applicable data protection laws including GDPR and the Indian Information Technology Act.</p></section>
          <section><h2 className="font-heading text-dark text-2xl mb-3">CONTACT</h2><p>For privacy-related queries, use our <a href="/contact" className="text-accent-blue hover:underline">contact form</a>.</p></section>
        </div>
      </div>
    </div>
  );
}
