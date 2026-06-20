import { Skeleton } from "@/components/ui/skeleton"

export default function ResultsLoading() {
  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 space-y-8">
      {/* Hero summary bar skeleton */}
      <div className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="space-y-2">
            <Skeleton className="h-3 w-48" />
            <div className="flex items-baseline gap-2">
              <Skeleton className="h-12 w-20" />
              <Skeleton className="h-6 w-28" />
            </div>
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-18" />
          </div>
        </div>
        {/* Segmented bar skeleton */}
        <Skeleton className="h-4 w-full rounded-full" />
        {/* Gap line skeleton */}
        <Skeleton className="h-4 w-80" />
      </div>

      {/* Filter toggle skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-4 w-12" />
        <Skeleton className="h-8 w-32 rounded-full" />
        <Skeleton className="h-8 w-28 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
      </div>

      {/* Category gap tree skeleton */}
      <section className="space-y-3">
        <Skeleton className="h-6 w-36" />
        <div className="rounded-xl border bg-card shadow-sm divide-y">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-4 space-y-3">
              {/* Accordion trigger skeleton */}
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-48" />
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-1.5 w-32 rounded-full" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
                <Skeleton className="h-4 w-4 shrink-0" />
              </div>

              {/* Chip grid skeleton (expanded for the first accordion) */}
              {i === 1 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pl-7">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <div key={j} className="rounded-lg border p-3 space-y-1.5">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
