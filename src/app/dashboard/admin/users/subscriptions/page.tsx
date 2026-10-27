import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { SubscriptionsManagerV2 } from '@/components/admin/users/SubscriptionsManagerV2'
import { Zap } from 'lucide-react'

export default function AdminSubscriptionsPage() {
  return (
          <AdminPageContainer 
        title="Subscriptions"
        description="Manage user subscriptions and premium grants"
      >
        <SubscriptionsManagerV2 />
      </AdminPageContainer>
  )
}

