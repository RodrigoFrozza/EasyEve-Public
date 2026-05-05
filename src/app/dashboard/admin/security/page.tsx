import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { SecurityLogs } from '@/components/admin/SecurityLogs'

export default function AdminSecurityPage() {
  return (
          <AdminPageContainer
        title="Security Center"
        description="Review authentication and security-related events"
      >
        <SecurityLogs enablePolling />
      </AdminPageContainer>
  )
}

