import { Loader2 } from 'lucide-react'

export default function DashboardLoading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-8">
      <Loader2 className="h-10 w-10 animate-spin text-cyan-400" aria-hidden />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  )
}
