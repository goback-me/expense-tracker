export default function Loading() {
  return (
    <div className="flex-1 px-container-margin py-lg pb-24">
      <div className="mb-lg flex gap-2">
        <div className="h-8 w-14 animate-pulse rounded-full bg-surface-high" />
        <div className="h-8 w-20 animate-pulse rounded-full bg-surface-high" />
        <div className="h-8 w-16 animate-pulse rounded-full bg-surface-high" />
      </div>
      <div className="space-y-3">
        <div className="h-16 animate-pulse rounded-card bg-surface-high" />
        <div className="h-16 animate-pulse rounded-card bg-surface-high" />
        <div className="h-16 animate-pulse rounded-card bg-surface-high" />
        <div className="h-16 animate-pulse rounded-card bg-surface-high" />
      </div>
    </div>
  );
}