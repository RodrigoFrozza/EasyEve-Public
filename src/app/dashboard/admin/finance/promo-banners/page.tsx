import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { PromoBannersManagerV2 } from '@/components/admin/finance/PromoBannersManagerV2'
import { Image } from 'lucide-react'

export default function AdminPromoBannersPage() {
  return (
          <AdminPageContainer 
        title="Promo Banners"
        description="Manage promotional banners on the dashboard"
      >
        <PromoBannersManagerV2 />
      </AdminPageContainer>
  )
}

