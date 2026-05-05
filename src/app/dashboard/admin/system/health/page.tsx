import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { HealthMonitorV2 } from '@/components/admin/system/HealthMonitorV2'
import { Activity } from 'lucide-react'

export default function AdminHealthPage() {
  return (
          <AdminPageContainer 
        title="System Health"
        description="Monitor server resources and uptime"
      >
        <HealthMonitorV2 />
      </AdminPageContainer>
  )
}

