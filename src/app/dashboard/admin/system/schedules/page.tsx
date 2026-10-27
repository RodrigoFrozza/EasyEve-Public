'use client'

import { Suspense } from 'react'
import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { SchedulesDashboard } from '@/components/admin/system/SchedulesDashboard'
import { useTranslations } from '@/i18n/hooks'
import { Skeleton } from '@/components/ui/skeleton'

function SchedulesPageContent() {
  const { t } = useTranslations()

  return (
    <AdminPageContainer
      title={t('admin.schedules.pageTitle')}
      description={t('admin.schedules.pageDesc')}
    >
      <SchedulesDashboard />
    </AdminPageContainer>
  )
}

export default function AdminSystemSchedulesPage() {
  const { t } = useTranslations()

  return (
    <Suspense
      fallback={
        <AdminPageContainer
          title={t('admin.schedules.pageTitle')}
          description={t('admin.loading')}
        >
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-lg" />
            <Skeleton className="h-64 w-full rounded-lg" />
          </div>
        </AdminPageContainer>
      }
    >
      <SchedulesPageContent />
    </Suspense>
  )
}
