'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  placeholder?: string;
  initialValue?: string;
}

export function SearchBar({
  className,
  size = 'md',
  placeholder = "Find any LEGO set... go on then.",
  initialValue = '',
}: SearchBarProps) {
  const [query, setQuery] = useState(initialValue);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/compare?q=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={cn('relative flex w-full', className)}>
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className={cn(
          'w-full border-2 border-border bg-white text-dark placeholder-gray-400 font-body focus:outline-none focus:border-primary transition-colors rounded-l-lg',
          {
            'px-3 py-2 text-sm': size === 'sm',
            'px-4 py-3 text-base': size === 'md',
            'px-6 py-4 text-lg': size === 'lg',
          }
        )}
      />
      <button
        type="submit"
        className={cn(
          'bg-accent text-dark font-bold border-2 border-border border-l-0 rounded-r-lg hover:bg-accent-hover transition-colors flex items-center gap-2 whitespace-nowrap',
          {
            'px-3 py-2 text-sm': size === 'sm',
            'px-5 py-3 text-base': size === 'md',
            'px-8 py-4 text-lg': size === 'lg',
          }
        )}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {size === 'lg' && <span>Compare Prices</span>}
      </button>
    </form>
  );
}
