export default function Loading() {
  return (
    <div className="min-h-screen bg-white animate-pulse">
      {/* Hero skeleton */}
      <div className="h-48 bg-primary-dark/20 rounded-none" />

      <div className="max-w-site mx-auto px-4 py-10">
        <div className="h-8 w-56 bg-gray-200 rounded-lg mb-6" />

        {/* Deal card grid skeleton */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border overflow-hidden">
              <div className="aspect-square bg-gray-100" />
              <div className="p-3 space-y-2">
                <div className="h-3 w-16 bg-gray-200 rounded" />
                <div className="h-4 bg-gray-200 rounded" />
                <div className="h-4 w-3/4 bg-gray-200 rounded" />
                <div className="h-5 w-24 bg-gray-100 rounded mt-3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
