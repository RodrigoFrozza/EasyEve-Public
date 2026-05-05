import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { GlobalLogsV2 } from '@/components/admin/system/GlobalLogsV2'
import { Terminal } from 'lucide-react'

export default function AdminLogsPage() {
  return (
    <AdminPageContainer 
      title="System Logs"
      description="Monitor system errors and warnings in real-time"
    >
      <GlobalLogsV2 />
    </AdminPageContainer>
  )
}
