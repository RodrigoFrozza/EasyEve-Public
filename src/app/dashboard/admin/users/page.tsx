'use client'

import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { AccountListV2 } from '@/components/admin/users/AccountListV2'
import { useTranslations } from '@/i18n/hooks'

export default function AdminUsersPage() {
  const { t } = useTranslations()
  return (
    <AdminPageContainer
      title={t('admin.nav.accounts')}
      description={t('admin.manageAccounts')}
    >
      <AccountListV2 />
    </AdminPageContainer>
  )
}
