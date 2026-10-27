import { parseEVECargoLines } from '@/lib/parsers/eve-cargo-parser'
import { resolveNamesToTypes } from '@/lib/appraisal/resolve-names'
import { resolveHubDepth } from '@/lib/industry/market-depth'
import { fillFromOrders, type OrderBookFill } from '@/lib/market-prices'
import type { IndustryHub } from '@/lib/industry/config-store'

export interface HubScanItemHub {
  hubId: string
  hubName: string
  /** Player is BUYING this item — walked against the hub's SELL (ask) orders. */
  buy: OrderBookFill
  /** Player is SELLING this item (offloading surplus) — walked against the hub's BUY (bid) orders. */
  sell: OrderBookFill
}

export interface HubScanItem {
  typeId: number
  name: string
  /** Needed/pasted quantity (duplicate pasted lines for the same item are summed). */
  quantity: number
  hubs: HubScanItemHub[]
  /**
   * Cheapest hub to buy the full needed quantity, by avgUnitPrice among hubs that
   * ACTUALLY have stock (filledQty > 0). Prefers hubs that can fill the whole
   * order; only falls back to a partially-filling hub when none can. Null only
   * when no hub configured has ANY stock for this item.
   */
  cheapestBuyHubId: string | null
  /** False when no hub could fully fill the buy order — cheapestBuyHubId (if any)
   * is then only a partial fill, never silently presented as a guaranteed price. */
  anySufficient: boolean
}

export interface HubScanResult {
  items: HubScanItem[]
  /** Pasted names that didn't match a published SDE type — surfaced, never dropped. */
  unresolvedNames: string[]
  hubsScanned: { hubId: string; hubName: string }[]
}

/**
 * Multi-hub shopping/price scanner: paste an EVE cargo list, get the real
 * order-book price + available quantity to BUY and to SELL the exact needed
 * quantity at EVERY configured trade hub — not just the top-of-book at one hub.
 *
 * Every hub is fetched in ONE Promise.all (never sequential awaits in a loop —
 * see the perf incident this constraint exists to prevent). A hub with no data
 * for an item still gets a real (empty) fill result, never omitted or blank.
 */
export async function computeHubScan(input: {
  text: string
  hubs: IndustryHub[]
  characterIds: number[]
}): Promise<HubScanResult> {
  if (input.hubs.length === 0) {
    throw new Error('Configure at least one hub in Industry Settings before scanning')
  }

  const parsedLines = parseEVECargoLines(input.text)
  if (parsedLines.length === 0) {
    throw new Error('Paste at least one item to scan')
  }

  const { resolved, unresolved } = await resolveNamesToTypes(parsedLines.map((l) => l.displayName))

  // Aggregate by typeId: two pasted lines for the same item (duplicate stacks, or
  // different spellings that resolve to the same type) collapse into one demand —
  // the order book prices a TYPE, not a physical stack.
  const byType = new Map<number, { typeId: number; name: string; quantity: number }>()
  for (const line of parsedLines) {
    const hit = resolved.get(line.displayName.toLowerCase())
    if (!hit) continue
    const existing = byType.get(hit.typeId)
    if (existing) existing.quantity += line.quantity
    else byType.set(hit.typeId, { typeId: hit.typeId, name: hit.name, quantity: line.quantity })
  }

  const items = [...byType.values()]
  const typeIds = items.map((i) => i.typeId)

  // One depth fetch per hub (each already batched across all typeIds internally),
  // all hubs in parallel — never sequential per-hub or per-item awaits.
  const hubDepths = await Promise.all(
    input.hubs.map((hub) => resolveHubDepth(hub, input.characterIds, typeIds))
  )

  const resultItems: HubScanItem[] = items.map((item) => {
    const hubs: HubScanItemHub[] = hubDepths.map((hd) => {
      const depth = hd.depth[item.typeId]
      const buy = fillFromOrders(depth?.sell ?? [], item.quantity)
      const sell = fillFromOrders(depth?.buy ?? [], item.quantity)
      return { hubId: hd.hubId, hubName: hd.hubName, buy, sell }
    })

    const hubsWithStock = hubs.filter((h) => h.buy.filledQty > 0)
    const fullyFillingHubs = hubsWithStock.filter((h) => h.buy.sufficient)
    const anySufficient = fullyFillingHubs.length > 0
    // Prefer a hub that can fill the whole order; fall back to whichever hub has
    // ANY stock (never a hub with zero fill — its avgUnitPrice is 0, which would
    // look like the cheapest, silently misleading the user). Explicit anySufficient
    // flag tells the caller when the pick is only a partial fill.
    const candidatePool = anySufficient ? fullyFillingHubs : hubsWithStock
    let cheapestBuyHubId: string | null = null
    let cheapestBuyPrice = Infinity
    for (const h of candidatePool) {
      if (h.buy.avgUnitPrice < cheapestBuyPrice) {
        cheapestBuyPrice = h.buy.avgUnitPrice
        cheapestBuyHubId = h.hubId
      }
    }

    return {
      typeId: item.typeId,
      name: item.name,
      quantity: item.quantity,
      hubs,
      cheapestBuyHubId,
      anySufficient,
    }
  })

  return {
    items: resultItems,
    unresolvedNames: unresolved,
    hubsScanned: hubDepths.map((hd) => ({ hubId: hd.hubId, hubName: hd.hubName })),
  }
}
