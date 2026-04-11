import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Affiliate Disclosure | Bricks of India',
};

export default function AffiliateDisclosurePage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-heading text-dark text-5xl mb-2">AFFILIATE DISCLOSURE</h1>
        <p className="text-gray-400 text-sm mb-8">Last updated: April 2026</p>
        <div className="font-body space-y-6 text-gray-600 leading-relaxed">
          <p>Bricks of India participates in affiliate programs. Some &quot;Buy Now&quot; links on this website may earn us a small commission at no extra cost to you. This helps keep the website running and the price scrapers scraping.</p>
          <p>The Toycra ABHINAV12 discount code is part of an exclusive partnership with Toycra. When you use this code, you get 12% off your purchase and we may receive a small commission. The commission does not affect the discount you receive — you still get the full 12% off.</p>
          <p>Affiliate relationships do not influence our reviews, recommendations, or price comparisons. If we think a set is overpriced, we say so. If a store has terrible customer service, we&apos;ll mention it. Commission or not.</p>
          <p>We only recommend products and stores we genuinely believe in. If we think something is rubbish, we&apos;ll tell you it&apos;s rubbish. That&apos;s the whole point of this website.</p>
          <p>All affiliate relationships are disclosed within individual reviews and buying guides where relevant.</p>
        </div>
      </div>
    </div>
  );
}
