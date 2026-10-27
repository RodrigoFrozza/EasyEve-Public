import { prisma } from '@/lib/prisma'
import { withErrorHandling, validateBody } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Rejects javascript:/data: URLs — imageUrl feeds next/image (domain-restricted, but
// defense in depth) and link is rendered as a plain <a href> to every homepage visitor.
const httpUrlSchema = z.string().min(1).refine((value) => {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}, 'Must be an absolute http(s) URL')

const carouselInputSchema = z.object({
  imageUrl: httpUrlSchema,
  altText: z.string().nullish(),
  link: httpUrlSchema.nullish(),
  order: z.number().optional(),
  active: z.boolean().optional(),
})

const carouselUpdateSchema = carouselInputSchema.partial()

const carouselIdSchema = z.object({
  id: z.string(),
})

export const GET = withErrorHandling(withAuth({ requiredRole: 'master' }, async () => {
  const items = await prisma.homepageCarousel.findMany({
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  })
  return { items }
}))

export const POST = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request) => {
  const input = await validateBody(request, carouselInputSchema)
  
  const lastItem = await prisma.homepageCarousel.findFirst({
    orderBy: { order: 'desc' },
  })
  
  const item = await prisma.homepageCarousel.create({
    data: {
      imageUrl: input.imageUrl,
      altText: input.altText,
      link: input.link,
      order: input.order ?? (lastItem?.order ?? 0) + 1,
      active: input.active ?? true,
    },
  })
  
  return item
}))

export const PUT = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request) => {
  const { id, ...data } = await validateBody(request, carouselUpdateSchema.merge(carouselIdSchema))
  
  const item = await prisma.homepageCarousel.update({
    where: { id },
    data,
  })
  
  return item
}))

export const DELETE = withErrorHandling(withAuth({ requiredRole: 'master' }, async (request) => {
  const { id } = await validateBody(request, carouselIdSchema)
  
  await prisma.homepageCarousel.delete({
    where: { id },
  })
  
  return { success: true }
}))