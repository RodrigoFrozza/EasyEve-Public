import { MiningPriceBasis, MiningPriceUiConfidence } from '@/lib/mining-price-resolution'

export interface MiningLog {
  date: string
  quantity: number
  typeId: number
  charId: number
  charName: string
  solarSystemId: number
  oreName?: string
  volumeValue?: number
  amount?: number
  unitPrice?: number
  priceBasis?: MiningPriceBasis
  priceConfidence?: MiningPriceUiConfidence
}

export interface MiningOreBreakdown {
  typeId: number
  name: string
  icon: string
  quantity: number
  totalLootValue: number
  volumeValue: number
  buy: number
  sell: number
  compressedBuy: number
  compressedSell: number
  priceBasis: MiningPriceBasis
  priceConfidence: MiningPriceUiConfidence
}

export interface MiningParticipantBreakdown {
  charId: number
  charName: string
  quantity: number
  totalLootValue: number
  volumeValue: number
}

export interface MiningActivityData {
  logs: MiningLog[]
  baselines: Record<string, number>
  hasInitialBaseline: boolean
  oreBreakdown: Record<number, MiningOreBreakdown>
  participantBreakdown: Record<number, MiningParticipantBreakdown>
  participantEarnings: Record<number, number>
  totalQuantity: number
  totalLootValue: number
  miningValue: number
  currentM3PerHour: number
  m3Trend: 'up' | 'down' | 'stable'
  lastSyncAt: string
  miningType?: string
}
