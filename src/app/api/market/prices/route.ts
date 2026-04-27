import { withErrorHandling } from '@/lib/api-handler'
import { getMarketPrices } from '@/lib/esi'

export const dynamic = 'force-dynamic'

/**
 * GET /api/market/prices - Get current market prices
 * Query params:
 *   - typeIds: comma-separated list of type IDs. If omitted, returns all cached prices.
 */
export const GET = withErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url)
  const typeIdsParam = searchParams.get('typeIds') || searchParams.get('typeId')
  
  // Use the refactored getMarketPrices which handles persistent caching (SdeCache)
  const allPrices = await getMarketPrices()

  // If no specific IDs requested, return everything
  if (!typeIdsParam) {
    return allPrices
  }

  // Filter prices for requested IDs
  const typeIds = typeIdsParam
    .split(',')
    .map(id => parseInt(id.trim(), 10))
    .filter(id => !isNaN(id) && id > 0)
  
  const filteredPrices: Record<number, number> = {}
  for (const id of typeIds) {
    if (allPrices[id]) {
      filteredPrices[id] = allPrices[id]
    }
  }

  return filteredPrices
})