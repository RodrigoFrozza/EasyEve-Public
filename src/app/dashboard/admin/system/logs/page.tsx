'use client'

import { Suspense } from 'react'
import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { GlobalLogsV2 } from '@/components/admin/system/GlobalLogsV2'
import { useTranslations } from '@/i18n/hooks'

function LogsPageContent() {
  const { t } = useTranslations()
  return (
    <AdminPageContainer
      title={t('admin.nav.logs')}
      description={t('admin.logsTitle')}
    >
      <GlobalLogsV2 />
    </AdminPageContainer>
  )
}

export default function AdminLogsPage() {
  return (
    <Suspense fallback={null}>
      <LogsPageContent />
    </Suspense>
  )
}
