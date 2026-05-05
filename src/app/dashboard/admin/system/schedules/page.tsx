'use client'

import { Suspense } from 'react'
import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { SchedulesDashboard } from '@/components/admin/system/SchedulesDashboard'

function SchedulesPageContent() {
  return (
          <AdminPageContainer
        title="Scheduled Jobs"
        description="Monitor scheduler health, scheduled registry scripts, execution history, and run-now actions."
      >
        <SchedulesDashboard />
      </AdminPageContainer>
  )
}

export default function AdminSystemSchedulesPage() {
  return (
    <Suspense fallback={
              <AdminPageContainer title="Scheduled Jobs" description="Loading…">
          <div className="h-40 bg-eve-panel/60 animate-pulse rounded-lg" />
        </AdminPageContainer>
    }>
      <SchedulesPageContent />
    </Suspense>
  )
}

