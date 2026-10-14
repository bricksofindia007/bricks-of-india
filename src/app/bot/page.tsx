import type { Metadata } from 'next';
import { buildMetadata } from '@/lib/metadata';
import { BOT_CONTACT } from '@/lib/bot-identity';

// Site rule (email guard in CI): no harvestable "x@bricksofindia.com" literal in rendered HTML,
// so the contact address is written out as "bot [at] bricksofindia [dot] com".
// G19: this page says who the bot belongs to and how to reach us -- nothing about how it works.
const CONTACT_WORDS = BOT_CONTACT.replace('@', ' [at] ').replace(/\.com$/, ' [dot] com');

export const metadata: Metadata = buildMetadata({
  title: 'BricksOfIndiaBot',
  description: 'BricksOfIndiaBot belongs to Bricks of India.',
  path: '/bot',
});

export default function BotPage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h1 className="font-heading text-dark text-5xl mb-8">BRICKSOFINDIABOT</h1>
        <div className="prose prose-gray max-w-none font-body space-y-4 text-gray-600 leading-relaxed">
          <p>BricksOfIndiaBot belongs to Bricks of India.</p>
          <p>Questions or requests: <strong>{CONTACT_WORDS}</strong>.</p>
        </div>
      </div>
    </div>
  );
}
