import { cn } from '@/lib/utils';
import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-bold rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed',
          {
            'bg-primary text-dark hover:bg-yellow-400 focus:ring-primary shadow-md hover:shadow-lg active:scale-95':
              variant === 'primary',
            'bg-secondary text-white hover:bg-red-700 focus:ring-secondary shadow-md hover:shadow-lg active:scale-95':
              variant === 'secondary',
            'border-2 border-dark text-dark hover:bg-dark hover:text-white focus:ring-dark':
              variant === 'outline',
            'text-dark hover:bg-light-grey focus:ring-dark':
              variant === 'ghost',
            'bg-warning-orange text-white hover:bg-orange-600 focus:ring-warning-orange':
              variant === 'danger',
          },
          {
            'px-3 py-1.5 text-sm': size === 'sm',
            'px-5 py-2.5 text-base': size === 'md',
            'px-8 py-3.5 text-lg': size === 'lg',
          },
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
