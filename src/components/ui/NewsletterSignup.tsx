'use client';

import { useState } from 'react';
import Image from 'next/image';
import { MASCOTS } from '@/lib/brand';
import { supabase } from '@/lib/supabase';

export function NewsletterSignup() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    try {
      const { error } = await supabase.from('newsletter_subscribers').insert({ email });
      if (error && error.code !== '23505') throw error;
      setStatus('success');
      setMessage("You're in. Your wallet has been warned.");
      setEmail('');
    } catch {
      setStatus('error');
      setMessage("Something went wrong. Try again — your wallet needs this.");
    }
  };

  return (
    <section className="bg-dark py-16 px-4">
      <div className="max-w-site mx-auto">
        <div className="flex flex-col md:flex-row items-center gap-8">
          {/* Mascot */}
          <div className="shrink-0">
            <Image
              src={MASCOTS.both.celebrate}
              alt="Bricks of India mascots celebrating deals"
              width={200}
              height={200}
              className="object-contain"
            />
          </div>

          {/* Content */}
          <div className="flex-1 text-center md:text-left">
            <h2 className="font-heading text-primary text-4xl md:text-5xl mb-3">
              GET INDIA'S BEST LEGO DEALS
            </h2>
            <p className="text-gray-300 text-lg mb-6 font-body">
              Delivered before your wallet finds out. No spam. Unsubscribe anytime.
            </p>

            {status === 'success' ? (
              <div className="flex items-center gap-3 bg-deal-green/20 border border-deal-green rounded-xl px-6 py-4">
                <span className="text-3xl">🎉</span>
                <p className="text-deal-green font-bold text-lg">{message}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 max-w-lg">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="flex-1 px-4 py-3 rounded-lg border-2 border-gray-600 bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:border-primary transition-colors"
                />
                <button
                  type="submit"
                  disabled={status === 'loading'}
                  className="bg-primary text-dark font-bold px-6 py-3 rounded-lg hover:bg-yellow-400 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {status === 'loading' ? 'Signing up...' : 'Get Deals →'}
                </button>
              </form>
            )}

            {status === 'error' && (
              <p className="text-warning-orange text-sm mt-2">{message}</p>
            )}

            <p className="text-gray-500 text-xs mt-3">
              By subscribing, you agree to our{' '}
              <a href="/legal/privacy" className="underline hover:text-gray-300">Privacy Policy</a>.
              We don't sell data. We barely have time for our own wallets.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
