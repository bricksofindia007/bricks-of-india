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
          'bg-primary text-dark': variant === 'primary',
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
