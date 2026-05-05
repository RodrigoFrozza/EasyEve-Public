import { prisma } from '@/lib/prisma'
import { withErrorHandling, validateBody } from '@/lib/api-handler'
import { withAuth } from '@/lib/api-helpers'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const carouselInputSchema = z.object({
  imageUrl: z.string().min(1),
  altText: z.string().nullish(),
  link: z.string().nullish(),
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