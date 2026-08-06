'use client'

import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { ActivityHealthManager } from '@/components/admin/operations/ActivityHealthManager'
import { useTranslations } from '@/i18n/hooks'

export default function AdminActivityHealthPage() {
  const { t } = useTranslations()
  return (
    <AdminPageContainer
      title={t('admin.operations.activityHealthTitle')}
      description={t('admin.operations.activityHealthDesc')}
    >
      <ActivityHealthManager />
    </AdminPageContainer>
  )
}
