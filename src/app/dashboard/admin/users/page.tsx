import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { AccountListV2 } from '@/components/admin/users/AccountListV2'

export default function AdminUsersPage() {
  return (
    <AdminPageContainer 
      title="Users"
      description="Manage user accounts and permissions"
    >
      <AccountListV2 />
    </AdminPageContainer>
  )
}
