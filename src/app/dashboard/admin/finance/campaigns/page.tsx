import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { CampaignsManagerV2 } from '@/components/admin/finance/CampaignsManagerV2'
import { Megaphone } from 'lucide-react'

export default function AdminCampaignsPage() {
  return (
          <AdminPageContainer 
        title="Campaigns"
        description="Manage promotional campaigns"
      >
        <CampaignsManagerV2 />
      </AdminPageContainer>
  )
}

