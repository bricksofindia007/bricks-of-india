import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Data Deletion Instructions | Bricks of India',
  description: 'How to request deletion of your data from Bricks of India, including data accessed via Instagram/Facebook Login.',
};

export default function DataDeletionPage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-heading text-dark text-5xl mb-2">DATA DELETION INSTRUCTIONS</h1>
        <p className="text-gray-400 text-sm mb-8">Last updated: October 2026</p>
        <div className="font-body space-y-6 text-gray-600 leading-relaxed">
          <section>
            <h2 className="font-heading text-dark text-2xl mb-3">NEWSLETTER SUBSCRIBERS</h2>
            <p>If you subscribed to the Bricks of India newsletter, you can request deletion of your email address at any time by using the unsubscribe link in any email we send, or by contacting us via the <a href="/contact" className="text-accent-blue hover:underline">contact form</a>. We will delete your stored email address on request, as soon as reasonably possible.</p>
          </section>
          <section>
            <h2 className="font-heading text-dark text-2xl mb-3">INSTAGRAM / FACEBOOK DATA</h2>
            <p>Bricks of India&apos;s Instagram account (@bricksofindia) posts only content that we create ourselves, to our own account. We do not collect, store, or process personal data belonging to Instagram or Facebook users through this account &mdash; no follower data, comments, messages, or third-party profile information is accessed, retained, or shared.</p>
            <p>If you believe any data associated with your Instagram or Facebook account has been collected by Bricks of India in error, contact us via the <a href="/contact" className="text-accent-blue hover:underline">contact form</a> and we will investigate and delete any such data on request, as soon as reasonably possible.</p>
          </section>
          <section>
            <h2 className="font-heading text-dark text-2xl mb-3">HOW TO REQUEST DELETION</h2>
            <p>Email us via the <a href="/contact" className="text-accent-blue hover:underline">contact form</a> with the subject line &quot;Data Deletion Request&quot; and the email address or account you used. We will confirm receipt within 48 hours and complete deletion on request, as soon as reasonably possible, then confirm back to you by email.</p>
          </section>
          <section>
            <h2 className="font-heading text-dark text-2xl mb-3">SEE ALSO</h2>
            <p>For a full description of what data we collect and why, see our <a href="/legal/privacy" className="text-accent-blue hover:underline">Privacy Policy</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
