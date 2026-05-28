'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

const QUICK_RANGES = [
  { label: 'Under ₹2,000',    min: 0,     max: 2000   },
  { label: '₹2,000–5,000',    min: 2000,  max: 5000   },
  { label: '₹5,000–10,000',   min: 5000,  max: 10000  },
  { label: '₹10,000–20,000',  min: 10000, max: 20000  },
  { label: '₹20,000+',        min: 20000, max: 999999 },
];

export function BudgetForm({ defaultMin, defaultMax }: { defaultMin: number; defaultMax: number }) {
  const [min, setMin] = useState(defaultMin);
  const [max, setMax] = useState(defaultMax);
  const router = useRouter();

  function apply(newMin: number, newMax: number) {
    setMin(newMin);
    setMax(newMax);
    router.push(`/lab/budget-calculator?min=${newMin}&max=${newMax}`);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/lab/budget-calculator?min=${min}&max=${max}`);
  }

  const isQuickActive = (r: typeof QUICK_RANGES[0]) => min === r.min && max === r.max;

  return (
    <div>
      {/* Quick-select buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {QUICK_RANGES.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={() => apply(r.min, r.max)}
            style={{
              padding: '6px 14px', borderRadius: 20, border: '2px solid',
              borderColor: isQuickActive(r) ? '#F7A800' : '#e5e7eb',
              background: isQuickActive(r) ? '#F7A800' : '#fff',
              color: isQuickActive(r) ? '#fff' : '#374151',
              fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Custom range form */}
      <form onSubmit={handleSubmit} style={{ display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>
            Min (₹)
          </label>
          <input
            type="number"
            value={min}
            min={0}
            onChange={(e) => setMin(Math.max(0, Number(e.target.value)))}
            style={{ width: 120, padding: '8px 12px', border: '2px solid #e5e7eb', borderRadius: 8, fontSize: '1rem', fontWeight: 700 }}
          />
        </div>
        <div>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#6B7280', display: 'block', marginBottom: 4 }}>
            Max (₹)
          </label>
          <input
            type="number"
            value={max}
            min={0}
            onChange={(e) => setMax(Math.max(0, Number(e.target.value)))}
            style={{ width: 120, padding: '8px 12px', border: '2px solid #e5e7eb', borderRadius: 8, fontSize: '1rem', fontWeight: 700 }}
          />
        </div>
        <button
          type="submit"
          style={{
            padding: '10px 24px', background: '#F7A800', color: '#fff',
            border: 'none', borderRadius: 8, fontWeight: 700, fontSize: '0.95rem',
            cursor: 'pointer', boxShadow: '0 2px 0 #c87e00',
          }}
        >
          Find Sets
        </button>
      </form>
    </div>
  );
}
