import { ModuleUnavailable } from '@/components/shared/ModuleUnavailable'
import { isPlatformModuleActive } from '@/lib/admin/platform-module-gate'
import { platformModuleTitle } from '@/lib/admin/platform-module-meta'

export default async function PiLayout({ children }: { children: React.ReactNode }) {
  const isActive = await isPlatformModuleActive('pi')

  if (!isActive) {
    const moduleName = platformModuleTitle('pi')
    return (
      <div className="mx-auto max-w-[1600px] p-6 md:p-8">
        <ModuleUnavailable
          moduleName={moduleName}
          message={`The ${moduleName} module is currently disabled by administrators. Please check back later or contact support if you believe this is an error.`}
        />
      </div>
    )
  }

  return <>{children}</>
}
