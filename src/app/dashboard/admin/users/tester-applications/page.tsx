import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { TesterApplicationsManagerV2 } from '@/components/admin/users/TesterApplicationsManagerV2'
import { UserCheck } from 'lucide-react'

export default function AdminTesterApplicationsPage() {
  return (
          <AdminPageContainer 
        title="Tester Applications"
        description="Review and manage tester applications"
      >
        <TesterApplicationsManagerV2 />
      </AdminPageContainer>
  )
}

