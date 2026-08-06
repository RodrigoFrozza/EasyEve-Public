import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function CharacterCardSkeleton() {
  return (
    <Card className="relative overflow-hidden border-eve-border bg-eve-panel">
      <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-zinc-700/20 blur-3xl" aria-hidden />
      <CardHeader className="relative z-10 pb-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-12 w-12 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative z-10 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <Skeleton className="h-14 w-full rounded-md" />
          <Skeleton className="h-14 w-full rounded-md" />
          <Skeleton className="col-span-2 h-14 w-full rounded-md" />
        </div>
        <div className="space-y-1.5 rounded-md bg-black/15 p-2">
          <Skeleton className="h-3 w-24" />
          <div className="flex flex-wrap gap-1.5">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-6 rounded-full" />
          </div>
        </div>
        <div className="flex gap-2 rounded-md bg-black/10 p-2">
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-8 w-8" />
        </div>
      </CardContent>
    </Card>
  )
}
