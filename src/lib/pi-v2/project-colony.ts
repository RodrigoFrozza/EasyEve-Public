/**
 * `projectColonyState` — a função pura no centro do módulo.
 *
 * Determinística, sem efeito colateral, escrita UMA vez e consumida por dois
 * lados: o cliente (tick visual, sensação de tempo real) e o scheduler
 * server-side (alerta com o app fechado). É esse compartilhamento que garante
 * que o número da tela e o número do alerta nunca divirjam.
 *
 * Entra o snapshot cru da ESI + o contrato de reabastecimento; sai o estado
 * estimado AGORA, sempre acompanhado do selo de confiança. O motor projeta
 * "se nada mudar" — ele não prevê ação do jogador (reinício de extrator, coleta
 * manual). Esse é o limite honesto, e é por isso que o selo é obrigatório.
 */

import type { PiColonyLayout, PiColonySummary } from '@/lib/pi-v2/esi'
import { computeDemandModel, type CommodityBalance } from '@/lib/pi-v2/demand'
import {
  extractorCurrentUnitsPerHour,
  extractorDesignedUnitsPerHour,
  isExtractorExpired,
} from '@/lib/pi-v2/extractor'
import {
  aggregateColonyStatus,
  isExportProductionActive,
  resolveCadenceHrs,
  simulateStoreBuffers,
  type ColonyBufferStatus,
  type StoreBufferStatus,
} from '@/lib/pi-v2/buffers'
import { resolveConfidence, type ProjectionConfidence } from '@/lib/pi-v2/projection'
import { getCommodityName, isProcessorRole, pinRole } from '@/lib/pi-v2/sde'

/**
 * O que o jogador DECLARA, porque a ESI não sabe: de quanto em quanto tempo ele
 * visita o planeta para repor insumo. Tudo o mais o motor deriva das rotas.
 *
 * Nível simples (default): só a cadência. O nível avançado (por storage, por
 * item, com antecedência própria) entra numa fase posterior — este tipo é o
 * ponto de extensão.
 */
export interface RestockContract {
  /** Horas entre visitas de reabastecimento. Ausente = 24h. */
  visitCadenceHrs?: number
}

/** Papel da colônia, derivado do layout (não configurado). */
export type ColonyRole = 'integrated' | 'factory_only' | 'extraction_only' | 'unknown'

export interface ExtractorState {
  pinId: number
  productTypeId: number
  productName: string
  qtyPerCycle: number
  cycleTimeSec: number
  installTime?: string
  expiryTime?: string
  isExpired: boolean
  /** Horas até o programa vencer. Negativo/0 quando já venceu. */
  expiresInHrs?: number
  designedUnitsPerHour: number
  currentUnitsPerHour: number
}

export interface ColonyProjection {
  planetId: number
  planetType: string
  solarSystemId: number
  upgradeLevel: number
  numPins: number
  colonyRole: ColonyRole
  /** Selo obrigatório: idade do dado e se a projeção foi de fato aplicada. */
  confidence: ProjectionConfidence
  /** Cadência efetivamente usada (a declarada ou o default de 24h). */
  cadenceHrs: number
  /** Estado dos stores AGORA, com estoque e volume projetados. */
  stores: StoreBufferStatus[]
  /** Status da colônia — o estado da SAÍDA, não o do pior pin. */
  status: ColonyBufferStatus
  /**
   * Estoque PROJETADO em mãos, somado por commodity em todos os stores da
   * colônia. É o que a lista de compra desconta do consumo bruto.
   *
   * Cobre só o que está DENTRO da colônia (launchpads e storages, que a ESI de
   * PI expõe). Material parado no hangar da estação é outra fonte — precisa do
   * scope de assets — e não entra aqui. Descontar o que não se enxerga seria
   * inventar estoque.
   *
   * Herda o selo: se `confidence.projectionApplied` é false, estes números são
   * o snapshot cru e o desconto herda a mesma incerteza.
   */
  stockOnHandByType: Record<number, number>
  balances: {
    /** A colônia rodando como foi desenhada (base da lista de compra). */
    designed: CommodityBalance[]
    /** O que roda agora, limitado pela realidade (base do P&L honesto). */
    current: CommodityBalance[]
  }
  extractors: ExtractorState[]
}

export interface ProjectColonyStateInput {
  summary: PiColonySummary
  layout: PiColonyLayout
  contract?: RestockContract
  /** Instante-alvo da projeção. Default: agora. */
  nowMs?: number
}

function classifyColonyRole(layout: PiColonyLayout): ColonyRole {
  const hasExtractor = layout.pins.some((p) => pinRole(p.type_id) === 'extractor')
  const hasFactory = layout.pins.some((p) => isProcessorRole(pinRole(p.type_id)))
  if (hasExtractor && hasFactory) return 'integrated'
  if (hasFactory) return 'factory_only'
  if (hasExtractor) return 'extraction_only'
  return 'unknown'
}

function buildExtractorStates(layout: PiColonyLayout, nowMs: number): ExtractorState[] {
  const states: ExtractorState[] = []

  for (const pin of layout.pins) {
    if (pinRole(pin.type_id) !== 'extractor') continue
    const details = pin.extractor_details
    const productTypeId = details?.product_type_id ?? 0
    const qtyPerCycle = details?.qty_per_cycle ?? 0
    const cycleTimeSec = details?.cycle_time ?? 0
    const isExpired = isExtractorExpired(pin.expiry_time, nowMs)

    const expiryMs = pin.expiry_time ? Date.parse(pin.expiry_time) : Number.NaN
    const expiresInHrs = Number.isFinite(expiryMs) ? (expiryMs - nowMs) / 3_600_000 : undefined

    states.push({
      pinId: pin.pin_id,
      productTypeId,
      productName: getCommodityName(productTypeId),
      qtyPerCycle,
      cycleTimeSec,
      installTime: pin.install_time,
      expiryTime: pin.expiry_time,
      isExpired,
      expiresInHrs,
      designedUnitsPerHour: extractorDesignedUnitsPerHour(
        qtyPerCycle,
        cycleTimeSec,
        pin.install_time,
        pin.expiry_time
      ),
      currentUnitsPerHour: isExpired
        ? 0
        : extractorCurrentUnitsPerHour(
            qtyPerCycle,
            cycleTimeSec,
            pin.install_time,
            pin.expiry_time,
            nowMs
          ),
    })
  }

  return states
}

export function projectColonyState(input: ProjectColonyStateInput): ColonyProjection {
  const { summary, layout } = input
  const nowMs = input.nowMs ?? Date.now()
  const cadenceHrs = resolveCadenceHrs(input.contract?.visitCadenceHrs)

  // T₀ é `last_update` — o instante em que o CLIENTE do jogo recalculou a colônia,
  // não o do último sync ESI. Daí sai quanto a projeção pode avançar (0 se a
  // banda suspendeu) e o selo que acompanha todo número desta função.
  const confidence = resolveConfidence(summary.last_update, nowMs)

  const demand = computeDemandModel(layout, nowMs)

  // Tetos da visão corrente: entrada limitada ao que de fato se produz/extrai
  // agora, saída limitada ao que de fato se consome. Sem eles, uma colônia parada
  // ainda reportaria fluxo desenhado e cronômetros fantasmas.
  const inflowCapByType = new Map(
    demand.current.map((b) => [
      b.typeId,
      Math.max(0, b.productionPerHour, b.extractionPerHour, b.exportedPerHour),
    ])
  )
  const outflowCapByType = new Map(
    demand.current.map((b) => [b.typeId, Math.max(0, b.demandPerHour)])
  )

  const stores = simulateStoreBuffers({
    layout,
    balances: demand.current,
    assumeImports: false,
    inflowCapByType,
    outflowCapByType,
    visitCadenceHrs: cadenceHrs,
    projectionHours: confidence.effectiveElapsedHrs,
    snapshotAgeHours: confidence.ageHours,
  })

  const status = aggregateColonyStatus(stores, cadenceHrs, {
    exportProductionActive: isExportProductionActive(demand.current),
  })

  // Estoque em mãos: soma do inventário projetado de todos os stores. Derivado
  // do que os buffers já calcularam — nenhum recálculo, nenhuma releitura do
  // snapshot cru.
  const stockOnHandByType: Record<number, number> = {}
  for (const store of stores) {
    for (const content of store.projectedContents) {
      stockOnHandByType[content.typeId] = (stockOnHandByType[content.typeId] ?? 0) + content.amount
    }
  }

  return {
    planetId: summary.planet_id,
    planetType: summary.planet_type,
    solarSystemId: summary.solar_system_id,
    upgradeLevel: summary.upgrade_level ?? 0,
    numPins: summary.num_pins ?? layout.pins.length,
    colonyRole: classifyColonyRole(layout),
    confidence: {
      ageHours: confidence.ageHours,
      band: confidence.band,
      anchorIso: confidence.anchorIso,
      projectionApplied: confidence.projectionApplied,
    },
    cadenceHrs,
    stores,
    status,
    stockOnHandByType,
    balances: { designed: demand.designed, current: demand.current },
    extractors: buildExtractorStates(layout, nowMs),
  }
}
