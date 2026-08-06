/**
 * Leitura e migração da configuração de frete guardada no cliente.
 *
 * Vive fora do hook de propósito: **a migração é a parte que não pode errar.** O
 * Rodrigo tem config real das Etapas 5 e 7 (base UALX-3, C-J6 com contrato, Jita
 * com ISK/m³) e ela precisa atravessar o redesenho inteira. Uma função pura é
 * testável sem React, e é onde o teste de migração mora.
 *
 * A regra da migração: **nada se perde e nada se inventa.**
 *
 *  - a estação que era `local` (frete 0) vira a **base central**
 *  - as outras viram hubs com a perna de ENTRADA que já tinham
 *  - Região e Jita, que eram dois números soltos, viram hubs de verdade: número
 *    positivo → courier com aquele `per m³`; zero → hub **sem perna**, que a tela
 *    rotula "não configurado" em vez de chamar de grátis
 *
 * Zero nunca é tratado como preço: nas etapas anteriores o default era 0, e quem
 * não configurou tem que ver que não configurou.
 */

import {
  isPublicHubId,
  JITA_HUB_ID,
  REGION_HUB_ID,
  type BaseHub,
  type FreightHub,
  type FreightLeg,
} from '@/lib/pi-v2/pricing/freight-model'

/** Teto de hubs de estrutura: cada um custa uma varredura de order book na ESI. */
export const MAX_STRUCTURE_HUBS = 6

export interface FreightPrefs {
  /** A base central. `null` = ninguém definiu ainda; a tela pede. */
  baseHub: BaseHub | null
  /** Hubs, sempre terminando com os dois públicos (Região e Jita). */
  hubs: FreightHub[]
  /** true = veio de um formato anterior. O hook guarda um backup antes de gravar. */
  migrated: boolean
}

/** Nomes estáveis dos hubs públicos. A tela traduz pelo id; isto é só rótulo. */
const PUBLIC_HUB_NAMES: Record<string, string> = {
  [REGION_HUB_ID]: 'Region',
  [JITA_HUB_ID]: 'Jita',
}

function positiveOrNull(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

function nonNegative(value: unknown): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function readLeg(raw: unknown): FreightLeg | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const l = raw as Record<string, unknown>

  if (l.method === 'local') return { method: 'local' }

  if (l.method === 'courier') {
    return {
      method: 'courier',
      transporter: typeof l.transporter === 'string' ? l.transporter : '',
      perM3Rate: positiveOrNull(l.perM3Rate),
      fullLoadReward: positiveOrNull(l.fullLoadReward),
      fullLoadVolumeM3: positiveOrNull(l.fullLoadVolumeM3),
      collateralRate: positiveOrNull(l.collateralRate),
      minReward: positiveOrNull(l.minReward),
    }
  }

  if (l.method === 'jf') {
    const jfTypeId = Number(l.jfTypeId)
    if (!Number.isFinite(jfTypeId) || jfTypeId <= 0) return undefined
    return {
      method: 'jf',
      jfTypeId,
      isotopeQtyRoundTrip: nonNegative(l.isotopeQtyRoundTrip),
      cargoM3: nonNegative(l.cargoM3),
      refuelAt: l.refuelAt === 'origin' || l.refuelAt === 'destination' ? l.refuelAt : undefined,
    }
  }

  return undefined
}

/**
 * A perna de um HUB. `local` é rejeitado aqui: **só a base é local.**
 *
 * "Local" significa "não há nada a mover porque eu já estou aqui", e isso só é
 * verdade na base. Num hub, `local` seria frete 0 com a justificativa errada — o
 * zero silencioso que este modelo existe para eliminar. Um hub sem perna sai
 * SEM perna, rotulado "não configurado", que é o que ele de fato é.
 *
 * Rejeitar na leitura (e não só na migração) conserta também a config que já foi
 * gravada no formato novo: `local` num hub nunca foi válido.
 */
function readHubLeg(raw: unknown): FreightLeg | undefined {
  const leg = readLeg(raw)
  return leg?.method === 'local' ? undefined : leg
}

function readHub(raw: unknown): FreightHub | null {
  if (!raw || typeof raw !== 'object') return null
  const h = raw as Record<string, unknown>
  const id = typeof h.id === 'string' ? h.id.trim() : ''
  if (!id) return null
  return {
    id,
    name: typeof h.name === 'string' && h.name.trim() ? h.name.trim() : (PUBLIC_HUB_NAMES[id] ?? id),
    inbound: readHubLeg(h.inbound),
    outbound: readHubLeg(h.outbound),
  }
}

/**
 * Garante que Região e Jita estejam presentes, no fim e sem duplicar. As duas são
 * fontes públicas: existem sempre, configuradas ou não.
 */
function withPublicHubs(hubs: FreightHub[]): FreightHub[] {
  const structures = hubs.filter((hub) => !isPublicHubId(hub.id)).slice(0, MAX_STRUCTURE_HUBS)
  const publics = [REGION_HUB_ID, JITA_HUB_ID].map(
    (id) =>
      hubs.find((hub) => hub.id === id) ?? { id, name: PUBLIC_HUB_NAMES[id]!, inbound: undefined }
  )
  return [...structures, ...publics]
}

/** Uma estação como as Etapas 5/7 guardavam. */
interface LegacyStation {
  id: string
  name: string
  freightPerM3: number
  freightMode?: 'local' | 'contract' | 'jf'
  contract?: Record<string, unknown>
}

/** Formato mais antigo ainda: duas estruturas fixas, só com o frete. */
interface LegacyFreight {
  structure?: number
  structure2?: number
  region?: number
  jita?: number
}

/**
 * O modo efetivo daquela estação. Repete a regra que a Etapa 7 já aplicava: sem
 * modo gravado, frete 0 e sem contrato é a base do jogador; com taxa, é courier.
 */
function legacyMode(station: LegacyStation): 'local' | 'contract' {
  if (station.freightMode === 'local') return 'local'
  if (station.freightMode === 'contract') return 'contract'
  return station.contract || station.freightPerM3 > 0 ? 'contract' : 'local'
}

/**
 * A perna de entrada de uma estação antiga que **não** é a base.
 *
 * Estação com frete 0 (modo efetivo `local`) vira hub SEM perna, não hub `local`:
 * fora da base, frete 0 nunca significou "já estou aqui" — significa que ninguém
 * disse quanto custa trazer de lá. Chamar isso de `local` faria o hub entrar na
 * escolha por custo efetivo com frete 0 **e sem aviso**, ganhando comparações que
 * não ganhou — exatamente a falha que o rótulo "não configurado" impede.
 */
function legacyStationToHubLeg(station: LegacyStation): FreightLeg | undefined {
  if (legacyMode(station) === 'local') return undefined
  const contract = station.contract ? readLeg({ ...station.contract, method: 'courier' }) : undefined
  if (contract) return contract
  // Frete numérico solto e sem contrato: o número que o jogador já validou vira o
  // `per m³` do courier. Continua valendo exatamente o mesmo valor.
  if (station.freightPerM3 > 0) {
    return readLeg({ method: 'courier', perM3Rate: station.freightPerM3 })
  }
  return undefined
}

function readLegacyStations(parsed: Record<string, unknown>): LegacyStation[] {
  const raw = parsed.buyStations
  if (!Array.isArray(raw)) return []
  const out: LegacyStation[] = []
  for (const entry of raw) {
    const s = entry as Record<string, unknown> | null
    const id = typeof s?.id === 'string' ? s.id.trim() : ''
    if (!id) continue
    out.push({
      id,
      name: typeof s?.name === 'string' && s.name.trim() ? s.name.trim() : id,
      freightPerM3: nonNegative(s?.freightPerM3),
      freightMode:
        s?.freightMode === 'local' || s?.freightMode === 'contract' || s?.freightMode === 'jf'
          ? s.freightMode
          : undefined,
      contract:
        s?.contract && typeof s.contract === 'object'
          ? (s.contract as Record<string, unknown>)
          : undefined,
    })
  }
  return out
}

/** Frete público antigo: o campo novo primeiro, depois o do formato de antes. */
function publicHubFromRate(id: string, rate: number): FreightHub {
  return {
    id,
    name: PUBLIC_HUB_NAMES[id]!,
    // Zero não vira contrato de 0 ISK/m³: vira hub SEM perna. A diferença é entre
    // "custa nada" e "ninguém disse quanto custa", e a tela mostra a segunda.
    // Passa pelo `readLeg` para a perna migrada ter a MESMA forma de uma digitada
    // no formulário — os termos ausentes explícitos como `null` ("N/A").
    inbound: rate > 0 ? readLeg({ method: 'courier', perM3Rate: rate }) : undefined,
  }
}

/**
 * Lê a configuração guardada, migrando o que for de formato anterior.
 *
 * Aceita os três formatos que já existiram, do mais novo para o mais antigo. O
 * mais antigo (`freight.structure*`) não guardava os IDs das estruturas — eles
 * vinham do perfil no servidor — então só os fretes públicos migram aqui; as
 * estruturas entram depois, pela semeadura.
 */
export function readFreightPrefs(parsed: unknown): FreightPrefs {
  if (!parsed || typeof parsed !== 'object') {
    return { baseHub: null, hubs: withPublicHubs([]), migrated: false }
  }
  const p = parsed as Record<string, unknown>

  // Formato novo: base + hubs.
  if (Array.isArray(p.hubs) || p.baseHub !== undefined) {
    const hubs = Array.isArray(p.hubs)
      ? p.hubs.map(readHub).filter((h): h is FreightHub => h != null)
      : []
    const base = readHub(p.baseHub)
    return {
      baseHub: base ? { id: base.id, name: base.name } : null,
      hubs: withPublicHubs(hubs),
      migrated: false,
    }
  }

  const stations = readLegacyStations(p)
  const legacyFreight = (p.freight ?? {}) as LegacyFreight

  // A base é a estação que já era `local`. É a mesma estação onde ele está: a que
  // tinha frete 0 porque não há nada a mover.
  const baseIndex = stations.findIndex((s) => legacyMode(s) === 'local')
  const base = baseIndex >= 0 ? stations[baseIndex]! : null

  const structureHubs = stations
    .filter((_, i) => i !== baseIndex)
    .map<FreightHub>((station) => ({
      id: station.id,
      name: station.name,
      inbound: legacyStationToHubLeg(station),
    }))

  const regionRate = nonNegative(p.regionFreightPerM3 ?? legacyFreight.region)
  const jitaRate = nonNegative(p.jitaFreightPerM3 ?? legacyFreight.jita)

  return {
    baseHub: base ? { id: base.id, name: base.name } : null,
    hubs: [
      ...structureHubs.slice(0, MAX_STRUCTURE_HUBS),
      publicHubFromRate(REGION_HUB_ID, regionRate),
      publicHubFromRate(JITA_HUB_ID, jitaRate),
    ],
    // Só marca migração quando havia de fato algo do formato antigo para migrar.
    migrated: stations.length > 0 || regionRate > 0 || jitaRate > 0,
  }
}

/**
 * Fretes das duas estruturas fixas do formato mais antigo, na ordem em que o
 * perfil as guardava. Usados uma única vez para semear os hubs de quem só tinha
 * aquele formato — sem isto, a config sumiria na primeira abertura da tela nova.
 */
export function readLegacyStructureRates(parsed: unknown): number[] {
  if (!parsed || typeof parsed !== 'object') return []
  const p = parsed as Record<string, unknown>
  // Já migrado (a lista/hubs existem): nada a semear.
  if (Array.isArray(p.buyStations) || Array.isArray(p.hubs)) return []
  const freight = (p.freight ?? {}) as LegacyFreight
  return [nonNegative(freight.structure), nonNegative(freight.structure2)]
}

/**
 * Semeia base + hubs a partir das estruturas do perfil v1 e dos fretes antigos.
 *
 * A primeira estrutura com frete 0 é a base (é assim que a config antiga
 * expressava "estou aqui"); as outras entram como hubs de courier com o número
 * que já valia.
 */
export function seedHubsFromLegacy(
  legacy: Array<{ id: string; name: string }>,
  rates: number[]
): { baseHub: BaseHub | null; hubs: FreightHub[] } {
  const stations: LegacyStation[] = legacy.slice(0, MAX_STRUCTURE_HUBS).map((s, i) => ({
    id: s.id,
    name: s.name,
    freightPerM3: nonNegative(rates[i]),
  }))
  const baseIndex = stations.findIndex((s) => legacyMode(s) === 'local')
  const base = baseIndex >= 0 ? stations[baseIndex]! : null
  return {
    baseHub: base ? { id: base.id, name: base.name } : null,
    hubs: stations
      .filter((_, i) => i !== baseIndex)
      .map((station) => ({
        id: station.id,
        name: station.name,
        inbound: legacyStationToHubLeg(station),
      })),
  }
}

export { withPublicHubs }
