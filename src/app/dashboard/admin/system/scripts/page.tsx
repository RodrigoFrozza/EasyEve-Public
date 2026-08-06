import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { ScriptManagerV2 } from '@/components/admin/system/ScriptManagerV2'
import { Wrench } from 'lucide-react'

export default function AdminScriptsPage() {
  return (
          <AdminPageContainer 
        title="Scripts"
        description="Manage and execute maintenance scripts"
      >
        <ScriptManagerV2 />
      </AdminPageContainer>
  )
}

