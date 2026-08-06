import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { MedalManagerV2 } from '@/components/admin/content/MedalManagerV2'
import { Medal } from 'lucide-react'

export default function AdminMedalsPage() {
  return (
          <AdminPageContainer 
        title="Medals"
        description="Manage user medals and achievements"
      >
        <MedalManagerV2 />
      </AdminPageContainer>
  )
}

