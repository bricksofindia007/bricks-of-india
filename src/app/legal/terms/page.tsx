import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Terms of Use | Bricks of India' };

export default function TermsPage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-heading text-dark text-5xl mb-2">TERMS OF USE</h1>
        <p className="text-gray-400 text-sm mb-8">Last updated: April 2026</p>
        <div className="font-body space-y-6 text-gray-600 leading-relaxed">
          <p>By accessing Bricks of India, you agree to the following terms. If you don&apos;t agree, the exit button is right there. No hard feelings.</p>
          <section><h2 className="font-heading text-dark text-2xl mb-3">CONTENT COPYRIGHT</h2><p>All written content, reviews, guides, and original text on Bricks of India is copyright © 2026 Bricks of India. You may not reproduce, distribute, or republish our content without prior written permission. Quotes with attribution and links back are fine. Wholesale copying is not.</p></section>
          <section><h2 className="font-heading text-dark text-2xl mb-3">REVIEWS &amp; OPINIONS</h2><p>Reviews and opinion pieces represent the personal views of Bricks of India. They are editorial opinions, not professional advice. We stand by our verdicts. If you disagree, feel free to buy the set anyway. It&apos;s your money.</p></section>
          <section><h2 className="font-heading text-dark text-2xl mb-3">PRICE INFORMATION</h2><p>This site is provided &quot;as is&quot; with no warranty on price accuracy. Prices are scraped automatically and may be incorrect or outdated. Always verify prices on the retailer&apos;s website before purchasing.</p></section>
          <section><h2 className="font-heading text-dark text-2xl mb-3">THIRD-PARTY LINKS</h2><p>Links to third-party websites (retailers, YouTube, Instagram, etc.) are provided for convenience only. We are not responsible for the content, pricing, or conduct of linked websites.</p></section>
          <section><h2 className="font-heading text-dark text-2xl mb-3">LEGO® TRADEMARK</h2><p>LEGO® is a registered trademark of The LEGO Group. This website is not affiliated with, authorized by, or endorsed by The LEGO Group.</p></section>
          <section><h2 className="font-heading text-dark text-2xl mb-3">CHANGES</h2><p>We may update these terms at any time. Continued use of the website constitutes acceptance of the updated terms.</p></section>
        </div>
      </div>
    </div>
  );
}
