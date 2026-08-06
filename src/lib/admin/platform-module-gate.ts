import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { prisma } from '@/lib/prisma'
import { platformModuleTitle } from '@/lib/admin/platform-module-meta'

/**
 * Throws 403 when the platform module row exists and is globally deactivated.
 * Missing rows are treated as active (same as activity launch and fits routes).
 */
export async function assertPlatformModuleActive(module: string): Promise<void> {
  const moduleConfig = await prisma.modulePrice.findUnique({
    where: { module: module.toLowerCase() },
  })

  if (moduleConfig && !moduleConfig.isActive) {
    const label = platformModuleTitle(module)
    throw new AppError(
      ErrorCodes.API_FORBIDDEN,
      `${label} is currently disabled by administrators.`,
      403
    )
  }
}

/**
 * Server/layout helper: true when module is globally available.
 */
export async function isPlatformModuleActive(module: string): Promise<boolean> {
  const moduleConfig = await prisma.modulePrice.findUnique({
    where: { module: module.toLowerCase() },
  })
  return !moduleConfig || moduleConfig.isActive
}
