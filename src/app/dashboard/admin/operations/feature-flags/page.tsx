'use client'

import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { FeatureFlagsManager } from '@/components/admin/operations/FeatureFlagsManager'
import { useTranslations } from '@/i18n/hooks'

export default function AdminFeatureFlagsPage() {
  const { t } = useTranslations()
  return (
    <AdminPageContainer
      title={t('admin.operations.featureFlagsTitle')}
      description={t('admin.operations.featureFlagsDesc')}
    >
      <FeatureFlagsManager />
    </AdminPageContainer>
  )
}
