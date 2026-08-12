export default function Loading() {
  return (
    <div className="flex-1 px-container-margin py-lg pb-24">
      <div className="mb-lg grid grid-cols-3 gap-2">
        <div className="h-16 animate-pulse rounded-card bg-surface-high" />
        <div className="h-16 animate-pulse rounded-card bg-surface-high" />
        <div className="h-16 animate-pulse rounded-card bg-surface-high" />
      </div>
      <div className="h-48 animate-pulse rounded-input bg-surface-high" />
    </div>
  );
}