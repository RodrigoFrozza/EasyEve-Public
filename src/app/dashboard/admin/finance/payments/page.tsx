import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { PaymentsManagerV2 } from '@/components/admin/finance/PaymentsManagerV2'
import { CreditCard } from 'lucide-react'

export default function AdminPaymentsPage() {
  return (
    <AdminPageContainer 
      title="Payments"
      description="Manage payment approvals and rejections"
    >
      <PaymentsManagerV2 />
    </AdminPageContainer>
  )
}
