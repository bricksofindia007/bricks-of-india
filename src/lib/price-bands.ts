// Price-filter bands (#381, 27 Sep 2026). Each label is a claim about its own
// bounds ("₹10,000+" = min 10,000), so they live together here and
// tests/price-bands.test.ts asserts every label matches its min/max.

/** /sets ?price= filter (inclusive max). */
export const SETS_PRICE_BANDS: Record<string, { min: number; max: number; label: string }> = {
  under2k: { min: 0,     max: 1999,    label: 'Under ₹2,000' },
  '2k5k':  { min: 2000,  max: 4999,    label: '₹2,000–5,000' },
  '5k10k': { min: 5000,  max: 9999,    label: '₹5,000–10,000' },
  '10k':   { min: 10000, max: 9_999_999, label: '₹10,000+' },
};

/** LAB budget calculator quick picks (exclusive max). */
export const BUDGET_QUICK_RANGES = [
  { label: 'Under ₹2,000',    min: 0,     max: 2000   },
  { label: '₹2,000–5,000',    min: 2000,  max: 5000   },
  { label: '₹5,000–10,000',   min: 5000,  max: 10000  },
  { label: '₹10,000–20,000',  min: 10000, max: 20000  },
  { label: '₹20,000+',        min: 20000, max: 999999 },
];
