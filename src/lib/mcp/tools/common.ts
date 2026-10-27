import { z } from 'zod'

export const MAX_PAGE_SIZE = 100

export const pageInput = {
  limit: z.number().int().min(1).max(MAX_PAGE_SIZE).default(25).describe('Page size (max 100)'),
  cursor: z.string().optional().describe('nextCursor from the previous page'),
}

export const sinceInput = z
  .string()
  .datetime({ offset: true })
  .optional()
  .describe('ISO timestamp; only rows created at/after this')

/** Prisma cursor args for `orderBy: [{ createdAt: 'desc' }, { id: 'desc' }]` lists. */
export function pageArgs(limit: number, cursor?: string) {
  return {
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: 'desc' as const }, { id: 'desc' as const }],
  }
}

/** Trims the look-ahead row fetched by `pageArgs` and derives the next cursor. */
export function toPage<T extends { id: string }>(rows: T[], limit: number) {
  const items = rows.slice(0, limit)
  return {
    items,
    nextCursor: rows.length > limit ? items[items.length - 1].id : null,
  }
}

export function truncate(text: string | null | undefined, max: number): string | null {
  if (text == null) return null
  return text.length > max ? `${text.slice(0, max)}… [${text.length - max} chars truncated]` : text
}
