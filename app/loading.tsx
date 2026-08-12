export default function Loading() {
  return (
    <div className="flex-1 px-container-margin pb-24 pt-6">
      <div className="mb-lg flex items-center gap-3">
        <div className="h-10 w-10 animate-pulse rounded-full bg-surface-high" />
        <div className="space-y-1.5">
          <div className="h-3 w-20 animate-pulse rounded bg-surface-high" />
          <div className="h-4 w-24 animate-pulse rounded bg-surface-high" />
        </div>
      </div>
      <div className="mb-md h-40 animate-pulse rounded-card bg-surface-high" />
      <div className="mb-lg grid grid-cols-2 gap-3">
        <div className="h-16 animate-pulse rounded-card bg-surface-high" />
        <div className="h-16 animate-pulse rounded-card bg-surface-high" />
      </div>
      <div className="space-y-3">
        <div className="h-16 animate-pulse rounded-card bg-surface-high" />
        <div className="h-16 animate-pulse rounded-card bg-surface-high" />
        <div className="h-16 animate-pulse rounded-card bg-surface-high" />
      </div>
    </div>
  );
}