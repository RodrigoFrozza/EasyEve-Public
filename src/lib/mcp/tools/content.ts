import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { DEFAULT_FEATURE_FLAGS } from '@/lib/feature-flags'
import { defineTool } from '../types'
import { pageArgs, pageInput, toPage, truncate } from './common'

export const listFeatureFlags = defineTool({
  name: 'list_feature_flags',
  title: 'List feature flags',
  description:
    'Every known feature flag with its effective value, its code default and whether a DB row overrides it.',
  input: z.object({}),
  readOnly: true,
  handler: async () => {
    // Read the rows directly instead of getResolvedFeatureFlags(): that helper
    // falls back to defaults on a DB error, which would hide the failure here.
    const rows = await prisma.featureFlag.findMany()
    return Object.entries(DEFAULT_FEATURE_FLAGS).map(([name, defaultValue]) => {
      const row = rows.find((r) => r.name === name)
      return {
        name,
        effective: row ? row.isEnabled : defaultValue,
        default: defaultValue,
        overriddenInDb: !!row,
        updatedAt: row?.updatedAt ?? null,
      }
    })
  },
})

export const listNews = defineTool({
  name: 'list_news',
  title: 'List news',
  description: 'News/forum/patch posts, newest first. Content truncated to 300 chars.',
  input: z.object({
    published: z.boolean().optional(),
    category: z.enum(['news', 'forum', 'patch']).optional(),
    ...pageInput,
  }),
  readOnly: true,
  handler: async ({ published, category, limit, cursor }) => {
    const rows = await prisma.news.findMany({
      where: {
        ...(published !== undefined ? { published } : {}),
        ...(category ? { category } : {}),
      },
      ...pageArgs(limit, cursor),
    })
    const page = toPage(rows, limit)
    return { ...page, items: page.items.map((n) => ({ ...n, content: truncate(n.content, 300) })) }
  },
})

export const listPromoBanners = defineTool({
  name: 'list_promo_banners',
  title: 'List promo banners',
  description: 'Promo banners/modals/toasts with targeting and schedule window, newest first.',
  input: z.object({
    isActive: z.boolean().optional(),
    ...pageInput,
  }),
  readOnly: true,
  handler: async ({ isActive, limit, cursor }) => {
    const rows = await prisma.promoBanner.findMany({
      where: isActive !== undefined ? { isActive } : {},
      include: { _count: { select: { interactions: true } } },
      ...pageArgs(limit, cursor),
    })
    const page = toPage(rows, limit)
    return { ...page, items: page.items.map((b) => ({ ...b, description: truncate(b.description, 300) })) }
  },
})
