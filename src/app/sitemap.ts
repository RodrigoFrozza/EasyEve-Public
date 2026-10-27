import { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'
import { PUBLIC_APP_URL } from '@/constants/external-links'

const FALLBACK_BASE = 'https://easyeve.cloud'

function resolveBaseUrl(): string {
  const raw = (PUBLIC_APP_URL || FALLBACK_BASE).replace(/\/$/, '')
  try {
    const u = new URL(raw)
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return u.origin
    }
  } catch {
    // ignore
  }
  return FALLBACK_BASE
}

function buildStaticEntries(baseUrl: string, now: Date): MetadataRoute.Sitemap {
  const staticRoutes = [
    { url: '/', lastModified: now, changeFrequency: 'daily' as const, priority: 1 },
    { url: '/login', lastModified: now, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: '/link-character', lastModified: now, changeFrequency: 'monthly' as const, priority: 0.8 },
    { url: '/market', lastModified: now, changeFrequency: 'hourly' as const, priority: 0.9 },
    { url: '/dashboard', lastModified: now, changeFrequency: 'daily' as const, priority: 0.7 },
  ]

  return staticRoutes.map((route) => ({
    url: `${baseUrl}${route.url}`,
    lastModified: route.lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = resolveBaseUrl()
  const now = new Date()
  const staticEntries = buildStaticEntries(baseUrl, now)

  try {
    const [publicFits, publicProfiles] = await Promise.all([
      prisma.fit.findMany({
        where: { visibility: 'PUBLIC' },
        select: { id: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 1000,
      }),
      prisma.userProfile.findMany({
        where: { isPublic: true },
        select: { userId: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 1000,
      }),
    ])

    const fitRoutes: MetadataRoute.Sitemap = publicFits.map((fit) => ({
      url: `${baseUrl}/fits/${fit.id}`,
      lastModified: fit.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))

    const playerRoutes: MetadataRoute.Sitemap = publicProfiles.map((profile) => ({
      url: `${baseUrl}/players/${profile.userId}`,
      lastModified: profile.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))

    return [...staticEntries, ...fitRoutes, ...playerRoutes]
  } catch (err) {
    console.warn('[sitemap] Prisma query failed; returning static routes only.', err)
    return staticEntries
  }
}
