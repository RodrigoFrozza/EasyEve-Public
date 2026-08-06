import { Skeleton } from '@/components/ui/skeleton'

export default function CharacterProfileLoading() {
  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-32" />
      </div>
      <Skeleton className="h-24 w-full rounded-sm" />
      <Skeleton className="h-32 w-full rounded-sm" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-sm" />
        ))}
      </div>
    </div>
  )
}
