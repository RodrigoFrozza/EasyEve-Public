// import { prisma } from '@/lib/prisma' -- Moved to dynamic import inside withCache
import { logger } from '@/lib/server-logger'

const DEFAULT_TTL = 10 * 60 * 1000 // 10 minutes

/**
 * Get data from SdeCache or execute fallback and store it
 */
export async function withCache<T>(
  key: string,
  fallback: () => Promise<T>,
  ttl: number = DEFAULT_TTL
): Promise<T> {
  // Never attempt to use Prisma in the browser
  if (typeof window !== 'undefined') {
    return fallback()
  }

  try {
    const { prisma } = await import('@/lib/prisma')
    const cached = await prisma.sdeCache.findUnique({
      where: { key }
    })

    if (cached && (!cached.expiresAt || new Date() < cached.expiresAt)) {
      return cached.value as T
    }

    const freshData = await fallback()
    
    await prisma.sdeCache.upsert({
      where: { key },
      create: {
        key,
        value: freshData as any,
        expiresAt: new Date(Date.now() + ttl)
      },
      update: {
        value: freshData as any,
        expiresAt: new Date(Date.now() + ttl)
      }
    })

    return freshData
  } catch (error) {
    logger.error('Cache', `Error managing key "${key}"`, error)
    return fallback()
  }
}
