import { prisma } from '@/lib/prisma'
import { ModuleUnavailable } from '@/components/shared/ModuleUnavailable'

export default async function FitsLayout({ children }: { children: React.ReactNode }) {
  const fitsModule = await prisma.modulePrice.findUnique({
    where: { module: 'fits' }
  })
  
  if (fitsModule && !fitsModule.isActive) {
    return (
      <div className="mx-auto max-w-[1600px] p-6 md:p-8">
        <ModuleUnavailable 
          moduleName="Fits Management" 
          message="The Ship Fitting module is currently disabled by administrators. Please check back later or contact support if you believe this is an error."
        />
      </div>
    )
  }

  return <>{children}</>
}
