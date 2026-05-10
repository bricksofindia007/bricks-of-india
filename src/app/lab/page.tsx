import type { Metadata } from 'next';
import Link from 'next/link';
import { LAB_TOOLS, type LabTool } from '@/lib/lab-tools';

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
      <section className="py-12 px-4" style={{ background: "var(--boi-sky)" }}>
        <div className="max-w-site mx-auto flex items-center justify-between">
          <div>
            <span
              className="inline-block text-xs font-bold tracking-widest mb-3 px-3 py-1 rounded-full"
              style={{ background: "var(--boi-green)", color: "#fff", letterSpacing: "0.1em" }}
            >
              THE LAB
            </span>
            <h1 className="font-heading text-6xl mb-2" style={{ color: "var(--boi-navy)" }}>
              The Lab
            </h1>
            <p className="font-body text-lg" style={{ color: "var(--boi-navy)", opacity: 0.75 }}>
              Where we overthink LEGO so you don&apos;t have to.
            </p>
          </div>
        </div>
      </section>

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
