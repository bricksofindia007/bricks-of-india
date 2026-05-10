import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { LAB_TOOLS, type LabTool } from '@/lib/lab-tools';
import { MASCOTS } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'The Lab | Bricks of India',
  description:
    'A growing collection of small tools that help you justify, postpone, or accelerate your next LEGO purchase.',
  alternates: { canonical: 'https://bricksofindia.com/lab' },
};

function LabTileCard({ tool }: { tool: LabTool }) {
  const isLive = tool.status === 'live';

  const inner = (
    <div
      className="bg-white border-2 border-border rounded-2xl p-6 flex flex-col gap-3 h-full"
      style={{ opacity: isLive ? 1 : 0.7 }}
    >
      <span className="text-4xl" aria-hidden="true">{tool.emoji}</span>
      <h2
        className="text-xl leading-tight"
        style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, color: 'var(--boi-navy)' }}
      >
        {tool.name}
      </h2>
      <p className="font-body text-text-secondary text-sm flex-1">{tool.tagline}</p>
      <div className="pt-1">
        {isLive ? (
          <span
            className="text-sm font-bold"
            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-fredoka)' }}
          >
            Try it →
          </span>
        ) : (
          <span className="text-sm text-text-secondary font-body">Coming soon</span>
        )}
      </div>
    </div>
  );

  if (isLive && tool.href) {
    return (
      <Link
        href={tool.href}
        className="block h-full hover:shadow-lg transition-shadow rounded-2xl"
        aria-label={`Open ${tool.name}`}
      >
        {inner}
      </Link>
    );
  }

  return <div className="h-full">{inner}</div>;
}

export default function LabPage() {
  return (
    <div className="bg-white min-h-screen">
      <div className="bg-dark py-12 px-4">
        <div className="max-w-site mx-auto flex items-center gap-6">
          <div className="flex-1">
            <h1 className="font-heading text-primary text-6xl mb-2">THE LAB</h1>
            <p className="text-gray-300 font-body text-lg">
              Where we overthink LEGO so you don&apos;t have to. Side experiments, tools,
              and questionable ideas — none of them are price comparison. We have a whole site for that.
            </p>
          </div>
          <Image src={MASCOTS.red.trophy} alt="The Lab" width={160} height={160}
            className="object-contain shrink-0 hidden md:block" />
        </div>
      </div>

      <div className="max-w-site mx-auto px-4 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {LAB_TOOLS.map((tool) => (
            <LabTileCard key={tool.id} tool={tool} />
          ))}
        </div>
      </div>
    </div>
  );
}
