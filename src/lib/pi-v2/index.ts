/**
 * PI v2 — API pública do módulo.
 *
 * O módulo existe para responder três perguntas, nesta ordem de urgência:
 *   1. Algo parou ou vai parar antes da minha próxima visita?  (todo login)
 *   2. O que eu compro, quanto, e onde?                         (diária)
 *   3. O que eu mudaria pra ganhar mais?                        (mensal, fase futura)
 *
 * Toda tela, todo número e toda config servem a uma das três, ou são detalhe
 * escondido, ou são lixo. Este índice é o teste de descarte em forma de código:
 * o que não aparece aqui não é superfície do módulo.
 *
 * Tudo atrás da flag `PI_V2` (ver `flag.ts`). Flag OFF = o módulo antigo em
 * `src/lib/pi` continua intacto, byte a byte.
 */

// --- Flag e rollout ---
export { isEnvFlagEnabledFor, isPiV2EnabledFor, PI_V2_FLAG_ENV } from '@/lib/pi-v2/flag'

// --- Contrato da ESI (entrada crua do motor) ---
export type {
  PiColonyLayout,
  PiColonySummary,
  PiExtractorDetails,
  PiLink,
  PiPin,
  PiRoute,
} from '@/lib/pi-v2/esi'

// --- Motor: a função pura no centro ---
export { projectColonyState } from '@/lib/pi-v2/project-colony'
export type {
  ColonyProjection,
  ColonyRole,
  ExtractorState,
  ProjectColonyStateInput,
  RestockContract,
} from '@/lib/pi-v2/project-colony'

// --- Selo de honestidade (obrigatório em todo número projetado) ---
export {
  bandAllowsProjection,
  elapsedHoursSince,
  projectStock,
  resolveConfidence,
  stalenessBand,
} from '@/lib/pi-v2/projection'
export type { ProjectionConfidence, StalenessBand } from '@/lib/pi-v2/projection'

// --- Estado dos buffers e vocabulário de status ---
export {
  aggregateColonyStatus,
  computeTimeToEmptyHrs,
  DEFAULT_VISIT_CADENCE_HRS,
  deriveStatus,
  isExportProductionActive,
  resolveCadenceHrs,
  simulateStoreBuffers,
} from '@/lib/pi-v2/buffers'
export type {
  BufferStatusKind,
  ColonyBufferStatus,
  CommodityFlow,
  StoreBufferStatus,
} from '@/lib/pi-v2/buffers'

// --- Modelo de demanda (derivado das rotas) ---
export { computeDemandModel } from '@/lib/pi-v2/demand'
export type { CommodityBalance, DemandModel } from '@/lib/pi-v2/demand'

// --- Economia: order book real e imposto sobre valor-base ---
export {
  composePriceMap,
  DEFAULT_PRICING_MODE,
  exportUnitPrice,
  importUnitPrice,
} from '@/lib/pi-v2/pricing/price-map'
export type {
  MarketPrice,
  PriceMap,
  PriceOrigin,
  PriceProvenance,
  PriceSources,
  PricingMode,
  SellSource,
} from '@/lib/pi-v2/pricing/price-map'
export {
  CUSTOMS_BASE_VALUE_BY_TIER,
  customsTaxPerHour,
  DEFAULT_EXPORT_TAX_RATE,
  IMPORT_CUSTOMS_FACTOR,
} from '@/lib/pi-v2/pricing/customs'
