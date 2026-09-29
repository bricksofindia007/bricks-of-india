import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/metadata';
import { PRICE_CADENCE } from '@/lib/price-freshness';
import { BOT_UA, BOT_PACE_MS, BOT_CONTACT } from '@/lib/bot-identity';

// Site rule (email guard in CI): no harvestable "x@bricksofindia.com" literal in rendered HTML.
// The UA is shown exactly as sent, with a <wbr/> after the @ (identical to read); the contact
// address is written out as "bot [at] bricksofindia [dot] com".
const [UA_BEFORE_AT, UA_AFTER_AT] = BOT_UA.split('@');
const CONTACT_WORDS = BOT_CONTACT.replace('@', ' [at] ').replace(/\.com$/, ' [dot] com');

// FP5.10 (P6 addendum item 3): who our price bot is, what it collects and how to reach us.
// Static page, no data reads (G1).
export const metadata: Metadata = buildMetadata({
  title: 'BricksOfIndiaBot: our price bot',
  description: 'Who BricksOfIndiaBot is, what it collects from retailer websites, how often it visits, and how to contact us.',
  path: '/bot',
});

export default function BotPage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-heading text-dark text-5xl mb-2">BRICKSOFINDIABOT</h1>
        <p className="text-gray-400 text-sm mb-8">The bot that keeps LEGO® prices on Bricks of India up to date</p>
        <div className="prose prose-gray max-w-none font-body space-y-6 text-gray-600 leading-relaxed">
          <section>
            <h2 className="font-heading text-dark text-2xl mb-3">WHO WE ARE</h2>
            <p>Bricks of India is an independent LEGO® price comparison and review site for India. BricksOfIndiaBot visits Indian retailers&apos; websites to read the prices of LEGO sets, so readers can compare them in one place and click through to buy from the retailer.</p>
            <p>It identifies itself with this user agent on every request:</p>
            <pre className="bg-surface rounded p-3 text-sm overflow-x-auto"><code>{UA_BEFORE_AT}@<wbr />{UA_AFTER_AT}</code></pre>
          </section>
          <section>
            <h2 className="font-heading text-dark text-2xl mb-3">WHAT IT COLLECTS</h2>
            <p>Only public product information that any visitor can see without logging in: the product name and set number, the listed price, whether it&apos;s in stock, and the product page&apos;s address.</p>
            <p><strong>Nothing personal.</strong> It never logs in, never adds to a cart, never submits forms, and never collects information about people: no customer, reviewer or account data of any kind.</p>
          </section>
          <section>
            <h2 className="font-heading text-dark text-2xl mb-3">HOW OFTEN</h2>
            <p>We check prices {PRICE_CADENCE}. Within a visit it makes at most one request every {BOT_PACE_MS / 1000} seconds to any one retailer, and it prefers the retailer&apos;s own product feed where one exists over loading many individual pages.</p>
          </section>
          <section>
            <h2 className="font-heading text-dark text-2xl mb-3">RULES IT FOLLOWS</h2>
            <p>It reads and follows each site&apos;s <code>robots.txt</code>, and <code>agents.md</code> where a retailer publishes one. It keeps a fingerprint of both. If either file changes, the bot stops for that retailer and writes nothing until a person has reviewed the change.</p>
          </section>
          <section>
            <h2 className="font-heading text-dark text-2xl mb-3">CONTACT</h2>
            <p>If you run one of these websites and want us to slow down, stop, or change what we read, email <strong>{CONTACT_WORDS}</strong> or use our <a href="/contact" className="text-primary underline">contact form</a>. A person reads every message, and we&apos;ll act on a request to stop straight away.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
