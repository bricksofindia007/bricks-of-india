import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/metadata';

export const metadata: Metadata = buildMetadata({
  title: 'Affiliate Disclosure',
  description: 'How affiliate links and the ABHINAV12 discount code work on Bricks of India, and what they mean for the prices you see.',
  path: '/legal/affiliate-disclosure',
});

export default function AffiliateDisclosurePage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-heading text-dark text-5xl mb-2">AFFILIATE DISCLOSURE</h1>
        <p className="text-gray-400 text-sm mb-8">Last updated: September 2026</p>
        <div className="font-body space-y-6 text-gray-600 leading-relaxed">
          <p>Bricks of India participates in affiliate programs. Some &quot;Buy Now&quot; links on this website may earn us a small commission at no extra cost to you. This helps keep the website running, and our own LEGO habit marginally less tragic.</p>
          <p>The Toycra ABHINAV12 discount code is part of an exclusive partnership with Toycra. When you use this code, you get 12% off full-price sets (it doesn&apos;t apply to items Toycra has already discounted) and we may receive a small commission. The commission does not affect the discount you receive — you still get the full 12% off.</p>
          <p>Affiliate relationships do not influence our reviews, recommendations, or price comparisons. If we think a set is overpriced, we say so. If a store has terrible customer service, we&apos;ll mention it. Commission or not.</p>
          <p>We only recommend products and stores we genuinely believe in. If we think something is rubbish, we&apos;ll tell you it&apos;s rubbish. That&apos;s the whole point of this website.</p>
          <p>Every page that shows the ABHINAV12 code links back here via the &quot;Disclosure&quot; link, and this page is linked from the footer of every page. Store &quot;Buy Now&quot; links are marked as sponsored links.</p>
        </div>
      </div>
    </div>
  );
}
