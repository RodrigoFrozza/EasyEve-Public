import {
  PI_SCHEMATICS,
  getCommodityName,
  type PiSchematic,
} from '@/lib/pi/pi-static-data'
import {
  importUnitPrice,
  type PiPriceMap,
  type PiPricingMode,
  DEFAULT_PI_PRICING_MODE,
} from '@/lib/pi/pi-pricing'
import { fillFromOrders, type MarketDepth } from '@/lib/market-prices'
import type { PiColonyAnalysis } from '@/lib/pi/types'

// One schematic per output commodity, so we can walk a product back to its inputs.
const schematicByOutput = new Map<number, PiSchematic>()
for (const schematic of Object.values(PI_SCHEMATICS)) {
  if (!schematicByOutput.has(schematic.output.typeId)) {
    schematicByOutput.set(schematic.output.typeId, schematic)
  }
}

export function getSchematicByOutput(typeId: number): PiSchematic | undefined {
  return schematicByOutput.get(typeId)
}

export type AutoproduceRecommendation =
  | 'autoproduce'
  | 'buy'
  | 'autoproduce_forced'
  | 'buy_forced'

export interface AutoproduceDecision {
  typeId: number
  name: string
  /** Market cost to buy one unit of the commodity ready-made. */
  buyReadyUnitCost: number
  /** Cost to make one unit from its inputs (buying those inputs). */
  autoproduceUnitCost: number
  /** buyReady − autoproduce; positive means self-producing is cheaper. */
  savingsPerUnit: number
  /** Market has depth to buy the commodity ready at the required rate. */
  outputStockSufficient: boolean
  /** Market has depth to buy the inputs needed to self-produce it. */
  inputStockSufficient: boolean
  recommendation: AutoproduceRecommendation
  reason: string
}

/**
 * Decide, for one intermediate commodity a P4 planet consumes (e.g. a P3),
 * whether to self-produce it (buy its inputs and convert) or buy it ready,
 * factoring in BOTH the margin and the real local-market stock. Stock beats
 * margin: an input the market can't supply must be self-produced even if
 * buying it would be cheaper, and vice-versa.
 */
export function evaluateAutoproduce(
  outputTypeId: number,
  requiredUnitsPerHour: number,
  prices: PiPriceMap,
  depth: Record<number, MarketDepth>,
  mode: PiPricingMode = DEFAULT_PI_PRICING_MODE
): AutoproduceDecision | null {
  const schematic = getSchematicByOutput(outputTypeId)
  if (!schematic || schematic.output.qty <= 0) return null

  const buyReadyUnitCost = importUnitPrice(prices, outputTypeId, mode)
  const autoproduceUnitCost = schematic.inputs.reduce(
    (sum, inp) =>
      sum + (inp.qty / schematic.output.qty) * importUnitPrice(prices, inp.typeId, mode),
    0
  )
  const savingsPerUnit = buyReadyUnitCost - autoproduceUnitCost

  // Market snapshot vs a day of throughput.
  const dailyOutput = requiredUnitsPerHour * 24
  const outputStockSufficient = fillFromOrders(
    depth[outputTypeId]?.sell ?? [],
    dailyOutput
  ).sufficient
  const inputStockSufficient = schematic.inputs.every((inp) => {
    const dailyInput = (inp.qty / schematic.output.qty) * dailyOutput
    return fillFromOrders(depth[inp.typeId]?.sell ?? [], dailyInput).sufficient
  })

  let recommendation: AutoproduceRecommendation
  let reason: string
  if (!outputStockSufficient && inputStockSufficient) {
    recommendation = 'autoproduce_forced'
    reason = 'market lacks stock to buy this ready — self-produce from inputs'
  } else if (!inputStockSufficient && outputStockSufficient) {
    recommendation = 'buy_forced'
    reason = 'market lacks stock for the inputs — buy this ready instead'
  } else if (savingsPerUnit > 0) {
    recommendation = 'autoproduce'
    reason = `self-producing saves ~${Math.round(savingsPerUnit).toLocaleString()} ISK/unit`
  } else {
    recommendation = 'buy'
    reason = `buying ready is cheaper by ~${Math.round(-savingsPerUnit).toLocaleString()} ISK/unit`
  }

  return {
    typeId: outputTypeId,
    name: getCommodityName(outputTypeId),
    buyReadyUnitCost,
    autoproduceUnitCost,
    savingsPerUnit,
    outputStockSufficient,
    inputStockSufficient,
    recommendation,
    reason,
  }
}

/**
 * Total ISK/h the portfolio would save by self-producing the intermediates the
 * advisor flags as cheaper to make than buy. Informational — it doesn't change
 * any colony's computed NET.
 */
export function sumAutoproduceSavingsPerHour(
  colonies: PiColonyAnalysis[],
  prices: PiPriceMap,
  depth: Record<number, MarketDepth>,
  mode: PiPricingMode = DEFAULT_PI_PRICING_MODE
): number {
  let total = 0
  for (const colony of colonies) {
    for (const b of colony.balances.potential) {
      if (b.importNeededPerHour <= 0) continue
      const decision = evaluateAutoproduce(b.typeId, b.importNeededPerHour, prices, depth, mode)
      if (decision?.recommendation === 'autoproduce' && decision.savingsPerUnit > 0) {
        total += decision.savingsPerUnit * b.importNeededPerHour
      }
    }
  }
  return total
}
