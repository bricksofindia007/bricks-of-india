export default function Loading() {
  return (
    <div className="min-h-screen bg-white animate-pulse">
      <div className="max-w-site mx-auto px-4 py-10">
        <div className="h-8 w-40 bg-gray-200 rounded-lg mb-6" />

        {/* Lab tool card grid skeleton -- also covers data-heavy sub-tools
            (cmf-tracker, price-drops, retiring-soon, heat-map, etc.) since
            this loading.tsx cascades to the whole /lab/* subtree. */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-2xl border-2 border-border p-6 space-y-3">
              <div className="h-10 w-10 bg-gray-100 rounded" />
              <div className="h-5 w-32 bg-gray-200 rounded" />
              <div className="h-4 w-full bg-gray-100 rounded" />
              <div className="h-4 w-2/3 bg-gray-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
