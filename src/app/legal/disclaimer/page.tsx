import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Disclaimer | Bricks of India',
  description: 'Important disclaimers about price accuracy, LEGO® trademark, and content on Bricks of India.',
};

export default function DisclaimerPage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-heading text-dark text-5xl mb-2">DISCLAIMER</h1>
        <p className="text-gray-400 text-sm mb-8">Last updated: April 2026</p>
        <div className="prose prose-gray max-w-none font-body space-y-6 text-gray-600 leading-relaxed">
          <section>
            <h2 className="font-heading text-dark text-2xl mb-3">PRICE ACCURACY</h2>
            <p>Prices shown on Bricks of India are scraped automatically from third-party retailer websites and may not be 100% accurate at the time of viewing. Always verify the final price on the retailer&apos;s website before completing a purchase. We update prices every 6 hours but cannot guarantee real-time accuracy.</p>
          </section>
          <section>
            <h2 className="font-heading text-dark text-2xl mb-3">PRODUCT AVAILABILITY</h2>
            <p>Product availability changes frequently. A set shown as &quot;in stock&quot; may have sold out by the time you visit the retailer. Always confirm availability directly with the store before ordering.</p>
          </section>
          <section>
            <h2 className="font-heading text-dark text-2xl mb-3">LEGO® TRADEMARK</h2>
            <p>LEGO® is a trademark of the LEGO Group of companies which does not sponsor, authorize, or endorse this website. Bricks of India is an independent media and price comparison website and is not affiliated with The LEGO Group in any way.</p>
          </section>
          <section>
            <h2 className="font-heading text-dark text-2xl mb-3">SET IMAGES</h2>
            <p>Set images are referenced from Rebrickable and official LEGO® CDN for informational and identification purposes only. All image rights belong to their respective owners.</p>
          </section>
          <section>
            <h2 className="font-heading text-dark text-2xl mb-3">NO LIABILITY</h2>
            <p>Bricks of India is not responsible for pricing errors, availability discrepancies, or any losses arising from purchases made based on information displayed on this website. Use information provided as a guide only and always conduct your own due diligence before purchasing.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
