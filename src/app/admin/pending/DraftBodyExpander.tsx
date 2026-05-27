'use client';

import { useState } from 'react';

export function DraftBodyExpander({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false);
  const preview = body.slice(0, 300);
  const hasMore = body.length > 300;

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 13, color: '#4B5563', lineHeight: 1.6,
        background: '#F9FAFB', padding: '10px 12px', borderRadius: 8,
        borderLeft: '3px solid #006CB7',
        whiteSpace: expanded ? 'pre-wrap' : 'normal',
      }}>
        <span style={{ fontSize: 10, color: '#006CB7', fontWeight: 700, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>
          Generated body
        </span>
        {expanded ? body : preview}{!expanded && hasMore && ' …'}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            marginTop: 6, fontSize: 12, color: '#006CB7',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 0, fontFamily: 'inherit', fontWeight: 600,
          }}
        >
          {expanded ? '↑ Collapse' : '↓ View Full'}
        </button>
      )}
    </div>
  );
}
