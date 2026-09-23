export function CatalogueSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="lot-card" aria-hidden>
          <div className="skeleton aspect-square rounded-none" />
          <div className="space-y-2.5 p-4">
            <div className="skeleton h-3 w-1/2" />
            <div className="skeleton h-4 w-[88%]" />
            <div className="skeleton h-4 w-2/3" />
            <div className="flex items-end justify-between pt-2">
              <div className="space-y-1.5">
                <div className="skeleton h-2.5 w-12" />
                <div className="skeleton h-4 w-20" />
              </div>
              <div className="skeleton h-3 w-14" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
