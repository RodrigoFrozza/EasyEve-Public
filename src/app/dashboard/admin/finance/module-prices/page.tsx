import { AdminPageContainer } from '@/components/admin/shared/AdminPageContainer'
import { PlatformModulesManagerV2 } from '@/components/admin/finance/ModulePricesManagerV2'

export default function AdminModulePricesPage() {
  return (
          <AdminPageContainer
        title="Platform modules"
        description="Enable or disable product areas for all users. Inactive modules block related APIs and UI."
      >
        <PlatformModulesManagerV2 />
      </AdminPageContainer>
  )
}

