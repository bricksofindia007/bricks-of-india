import Link from 'next/link';
import { LAB_TOOLS, type LabTool } from '@/lib/lab-tools';

function StripTile({ tool }: { tool: LabTool }) {
  const isLive = tool.status === 'live';

  const inner = (
    <div
      className="bg-white border-2 border-border rounded-2xl p-5 flex flex-col gap-2 h-full"
      style={{ opacity: isLive ? 1 : 0.7 }}
    >
      <span className="text-3xl" aria-hidden="true">{tool.emoji}</span>
      <p
        className="text-base leading-tight"
        style={{ fontFamily: 'var(--font-fredoka)', fontWeight: 700, color: 'var(--boi-navy)' }}
      >
        {tool.name}
      </p>
      <p className="font-body text-text-secondary text-xs flex-1">{tool.tagline}</p>
      <div className="pt-1">
        {isLive ? (
          <span
            className="text-xs font-bold"
            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-fredoka)' }}
          >
            Try it →
          </span>
        ) : (
          <span className="text-xs text-text-secondary font-body">Coming soon</span>
        )}
      </div>
    </div>
  );

  if (isLive && tool.href) {
    return (
      <Link
        href={tool.href}
        className="block h-full hover:shadow-md transition-shadow rounded-2xl"
        aria-label={`Open ${tool.name}`}
      >
        {inner}
      </Link>
    );
  }

  return <div className="h-full">{inner}</div>;
}

export function LabStrip() {
  // Live tools newest-first, then coming-soon in list order; cap at 3 for the strip.
  const liveTools = LAB_TOOLS.filter((t) => t.status === 'live').reverse();
  const comingTools = LAB_TOOLS.filter((t) => t.status === 'coming_soon');
  const stripTools = [...liveTools, ...comingTools].slice(0, 3);

  return (
    <section
      className="py-10 px-4"
      style={{ background: 'rgba(247, 168, 0, 0.05)' }}
      aria-label="The Lab — experimental tools"
    >
      <div className="max-w-site mx-auto">
        {/* Section header */}
        <div className="mb-6 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span
            className="text-sm font-bold tracking-widest uppercase"
            style={{ fontFamily: 'var(--font-fredoka)', color: '#F7A800' }}
          >
            THE LAB
          </span>
          <span className="text-sm text-text-secondary font-body">
            where we overthink LEGO so you don&apos;t have to
          </span>
        </div>

        {/* Tile row — horizontal snap-scroll on mobile, 3-col grid on sm+ */}
        <div
          className="flex gap-4 overflow-x-auto pb-2 sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0"
          style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        >
          {stripTools.map((tool) => (
            <div
              key={tool.id}
              className="flex-none w-[220px] sm:w-auto"
              style={{ scrollSnapAlign: 'start' }}
            >
              <StripTile tool={tool} />
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-6 text-center">
          <Link
            href="/lab"
            className="text-sm font-bold hover:underline"
            style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-fredoka)' }}
          >
            See all Lab tools →
          </Link>
        </div>
      </div>
    </section>
  );
}
