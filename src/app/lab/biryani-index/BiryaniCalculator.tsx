'use client';

import { useState } from 'react';

// LAST REFRESHED: 2026-04-26 — refresh quarterly
const REFERENCE_PRICES_INR = {
  biryani:         { value: 350,  label: 'plates of Hyderabadi biryani',    emoji: '🍛' },
  chai:            { value: 30,   label: 'cups of chai',                    emoji: '☕' },
  petrol:          { value: 110,  label: 'litres of petrol',                emoji: '⛽' },
  pvr_gold:        { value: 1200, label: 'PVR Gold Class tickets',          emoji: '🎬' },
  netflix_premium: { value: 649,  label: 'months of Netflix Premium',       emoji: '📺' },
  auto_rides:      { value: 80,   label: 'autorickshaw rides (Mumbai avg)', emoji: '🛺' },
} as const;

export function BiryaniCalculator() {
  const [input, setInput] = useState('');

  const price = parseFloat(input);
  const isEmpty = input === '' || isNaN(price) || price === 0;
  const isSuspicious = !isEmpty && price < 100;

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <div className="bg-dark py-12 px-4">
        <div className="max-w-site mx-auto text-center">
          <h1 className="font-heading text-primary text-5xl md:text-6xl mb-3">
            The Biryani Index
          </h1>
          <p className="text-gray-300 font-body text-lg max-w-xl mx-auto">
            Because every LEGO purchase needs justification, and rupees alone don&apos;t quite do it.
          </p>
        </div>
      </div>

      {/* Calculator */}
      <div className="max-w-3xl mx-auto px-4 py-10">
        {/* Input */}
        <div className="mb-10">
          <label htmlFor="set-price" className="block font-bold text-dark text-sm mb-2">
            Enter the set price in ₹
          </label>
          <input
            id="set-price"
            type="number"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. 4999"
            min="0"
            aria-label="LEGO set price in Indian rupees"
            className="w-full max-w-xs border-2 border-border rounded-lg px-4 py-3 font-price text-2xl text-dark focus:outline-none focus:border-primary transition-colors"
          />
          {isSuspicious && (
            <p className="mt-2 text-sm text-amber-600 font-body" role="alert">
              ₹{Math.floor(price).toLocaleString('en-IN')}? For a LEGO set? Are you sure?
            </p>
          )}
        </div>

        {/* Output */}
        {isEmpty ? (
          <p className="text-gray-400 font-body text-center py-16 text-lg">
            Type in a price. We&apos;ll do the maths. You&apos;ll feel either better or worse.
            There is no in-between.
          </p>
        ) : (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10"
            role="list"
            aria-label="Price comparisons"
          >
            {Object.values(REFERENCE_PRICES_INR).map((ref) => {
              const count = Math.floor(price / ref.value);
              return (
                <div
                  key={ref.label}
                  role="listitem"
                  className="bg-white border-2 border-border rounded-2xl p-6 text-center flex flex-col items-center gap-2 hover:border-primary transition-colors"
                >
                  <span className="text-5xl" aria-hidden="true">{ref.emoji}</span>
                  <span className="font-heading text-dark text-5xl leading-none">
                    {count.toLocaleString('en-IN')}
                  </span>
                  <span className="font-body text-sm text-gray-500 leading-snug">
                    {ref.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer note */}
        <p className="text-xs text-gray-400 text-center border-t border-border pt-6 font-body">
          Reference prices last updated April 2026. Mumbai-skewed. Your local prices may vary,
          your wallet&apos;s reaction will not. Do not show your CA.
        </p>
      </div>
    </div>
  );
}
