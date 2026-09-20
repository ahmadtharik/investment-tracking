function Skeleton({ className }: { className: string }) {
  return <div aria-hidden className={`rounded-[14px] bg-slate-200/80 ${className}`} />;
}

export default function Loading() {
  return <div className="w-full animate-pulse space-y-4" aria-busy="true" aria-label="Loading page">
    <Skeleton className="h-[156px] w-full" />
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
      <Skeleton className="h-[124px]" /><Skeleton className="h-[124px]" /><Skeleton className="h-[124px]" /><Skeleton className="h-[124px]" />
    </div>
    <div className="grid gap-4 2xl:grid-cols-[410px_minmax(0,1fr)_305px]"><Skeleton className="h-[358px]" /><Skeleton className="h-[358px]" /><Skeleton className="h-[358px]" /></div>
    <div className="grid gap-4 2xl:grid-cols-[426px_minmax(0,1fr)_305px]"><Skeleton className="h-[214px]" /><Skeleton className="h-[214px]" /><Skeleton className="h-[214px]" /></div>
    <span className="sr-only">Loading page…</span>
  </div>;
}
