'use client'

import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { PaymentsManagerV2 } from '@/components/admin/finance/PaymentsManagerV2'
import { useTranslations } from '@/i18n/hooks'

export default function AdminPaymentsPage() {
  const { t } = useTranslations()
  return (
    <AdminPageContainer
      title={t('admin.nav.payments')}
      description={t('admin.paymentsPageDesc')}
    >
      <PaymentsManagerV2 />
    </AdminPageContainer>
  )
}
