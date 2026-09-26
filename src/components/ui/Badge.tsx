import { cn } from '@/lib/utils';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'green' | 'orange' | 'blue' | 'grey';
  className?: string;
}

export function Badge({ children, variant = 'primary', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide',
        {
          'bg-primary text-white': variant === 'primary',
          'bg-secondary text-white': variant === 'secondary',
          'bg-deal-green text-white': variant === 'green',
          'bg-warning-orange text-white': variant === 'orange',
          'bg-accent-blue text-white': variant === 'blue',
          'bg-light-grey text-dark': variant === 'grey',
        },
        className
      )}
    >
      {children}
    </span>
  );
}

export function BestPriceBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 bg-deal-green text-white text-xs font-bold rounded-full badge-best-price">
      🏆 Best Price
    </span>
  );
}

export function OutOfStockBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-200 text-gray-500 text-xs font-bold rounded-full">
      Gone. Like your patience at checkout.
    </span>
  );
}

// R6 (PR-B): "Only at <store>" when exactly one store has it in stock.
export function OnlyAtBadge({ store }: { store: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 bg-light-grey text-dark text-xs font-bold rounded-full">
      Only at {store}
    </span>
  );
}

// R3 (PR-B): deal tier vs the MRP anchor. Listed price only -- no coupon applied.
export function DealBadge({ tier, pct }: { tier: 'hot' | 'deal'; pct: number | null }) {
  const off = pct != null ? ` −${Math.floor(pct)}%` : '';
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-white text-xs font-bold rounded-full ${tier === 'hot' ? 'bg-primary' : 'bg-warning-orange'}`}>
      {tier === 'hot' ? '🔥 Hot deal' : 'Deal'}{off}
    </span>
  );
}
