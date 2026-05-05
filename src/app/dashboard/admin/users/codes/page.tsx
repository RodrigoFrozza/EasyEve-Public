import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { CodesManagerV2 } from '@/components/admin/users/CodesManagerV2'
import { Key } from 'lucide-react'

export default function AdminCodesPage() {
  return (
          <AdminPageContainer 
        title="Activation Codes"
        description="Generate and manage activation codes"
      >
        <CodesManagerV2 />
      </AdminPageContainer>
  )
}

