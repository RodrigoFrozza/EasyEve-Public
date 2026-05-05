import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'

export default function AdminLoading() {
  return (
    <AdminPageContainer title="Loading..." description="Fetching data from central services">
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-eve-panel/40 animate-pulse rounded-lg border border-eve-border/20" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 bg-eve-panel/20 animate-pulse rounded-lg border border-eve-border/10" />
          ))}
        </div>
      </div>
    </AdminPageContainer>
  )
}
