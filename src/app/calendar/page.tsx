import Image from 'next/image';
import type { Metadata } from 'next';
import { MASCOTS } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'LEGO® India Release Calendar 2026 — New Sets & Launch Dates | Bricks of India',
  description: 'When are new LEGO® sets coming to India? Release dates, expected prices, and pre-order info for 2026 launches.',
  alternates: { canonical: 'https://bricksofindia.com/calendar' },
};

const UPCOMING_SETS = [
  { month: 'April 2026', sets: ['LEGO® Technic Bugatti Chiron', 'LEGO® Icons Eiffel Tower', 'LEGO® Star Wars AT-AT'] },
  { month: 'May 2026', sets: ['LEGO® Speed Champions F1 2026', 'LEGO® Harry Potter Hogwarts Express', 'LEGO® Botanical Bouquet'] },
  { month: 'June 2026', sets: ['LEGO® City Police Station', 'LEGO® Creator Expert Ferris Wheel', 'LEGO® Minecraft The Stronghold'] },
];

export default function CalendarPage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="bg-dark py-12 px-4">
        <div className="max-w-site mx-auto flex items-center gap-6">
          <div className="flex-1">
            <h1 className="font-heading text-primary text-6xl mb-2">INDIA RELEASE CALENDAR</h1>
            <p className="text-gray-300 font-body text-lg">
              When are new LEGO® sets arriving in India? Expected launch dates, prices, and pre-order info.
              Plan your spending. Or don&apos;t. Your wallet, your problem.
            </p>
          </div>
          <Image src={MASCOTS.blue.phone} alt="Release Calendar" width={160} height={160} className="object-contain shrink-0 hidden md:block" />
        </div>
      </div>

      <div className="max-w-site mx-auto px-4 py-10">
        <div className="bg-primary/10 border-2 border-primary rounded-2xl p-6 mb-8">
          <h2 className="font-heading text-dark text-2xl mb-2">🔔 GET NOTIFIED ABOUT NEW RELEASES</h2>
          <p className="text-gray-600 font-body mb-4">
            Sign up for the newsletter and we&apos;ll tell you when new sets hit Indian stores.
            Before your wallet even knows what&apos;s happening.
          </p>
          <a href="/#newsletter" className="inline-block bg-primary text-dark font-bold px-6 py-2 rounded-lg hover:bg-yellow-400 transition-colors">
            Subscribe to Deals Newsletter →
          </a>
        </div>

        <div className="space-y-8">
          {UPCOMING_SETS.map((month) => (
            <div key={month.month}>
              <h2 className="font-heading text-dark text-3xl mb-4 pb-2 border-b-2 border-dark">{month.month}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {month.sets.map((setName) => (
                  <div key={setName} className="bg-light-grey rounded-xl p-4 border-2 border-border flex items-center gap-3">
                    <span className="text-3xl">🧱</span>
                    <div>
                      <p className="font-bold text-dark text-sm">{setName}</p>
                      <p className="text-xs text-gray-400">India launch TBC</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center bg-light-grey rounded-2xl p-8">
          <p className="text-gray-400 font-body text-sm">
            Release dates are estimates based on global launches. India dates may vary.
            LEGO® is a trademark of The LEGO Group which does not sponsor or endorse this site.
          </p>
        </div>
      </div>
    </div>
  );
}
