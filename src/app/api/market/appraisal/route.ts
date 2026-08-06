import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'

export const dynamic = 'force-dynamic'

export const POST = withErrorHandling(async (req: Request) => {
  const body = await req.json().catch(() => ({}))
  const { items: rawItems } = body as { items: string[] }
  
  if (!rawItems || !Array.isArray(rawItems)) {
    return { prices: {} }
  }

  const { getMarketAppraisalWithIds } = await import('@/lib/market')
  const appraisal = await getMarketAppraisalWithIds(rawItems)
  
  // Maintain backward compatibility by providing a simple prices map
  const prices: Record<string, number> = {}
  Object.entries(appraisal).forEach(([name, data]) => {
    prices[name] = data.price
  })

  return { prices, appraisal }
})
