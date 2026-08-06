import {
  buildDigest,
  deriveAlertCandidates,
  resolveCooldownHrs,
  shouldNotify,
  V2_ALERT_PREFIX,
  type AlertCandidate,
} from '@/lib/pi-v2/alerts'
import { deriveColonyEvents } from '@/lib/pi-v2/events'
import { computeColonyGrid } from '@/lib/pi-v2/grid'
import { projectColonyState } from '@/lib/pi-v2/project-colony'
import { classifyColony } from '@/lib/pi-v2/urgency'
import type { PortfolioColony } from '@/lib/pi-v2/portfolio'
import {
  ANCHOR_ISO,
  HOUR_MS,
  TYPE_STERILE_CONDUITS,
  sterileConduitsColony,
  summaryWithLastUpdate,
} from '@/lib/pi-v2/__fixtures__/colonies'
import type { PiColonyLayout } from '@/lib/pi-v2/esi'

function portfolioColony(
  layout: PiColonyLayout,
  hoursAfterSnapshot: number,
  overrides: Partial<PortfolioColony> = {}
): PortfolioColony {
  const nowMs = Date.parse(ANCHOR_ISO) + hoursAfterSnapshot * HOUR_MS
  const summary = summaryWithLastUpdate(ANCHOR_ISO)
  const projection = projectColonyState({
    summary,
    layout,
    contract: { visitCadenceHrs: 24 },
    nowMs,
  })
  const events = deriveColonyEvents(projection, nowMs)
  return {
    characterId: 90001,
    characterName: 'Zeca Setaum',
    planetId: 40000001,
    planetName: '6-IAFR I',
    solarSystemId: 30000001,
    solarSystemName: '6-IAFR',
    planetType: 'barren',
    planetTypeLabel: 'Barren',
    projection,
    events,
    urgency: classifyColony(projection, events),
    grid: computeColonyGrid(layout, 5),
    ...overrides,
  }
}

describe('deriveAlertCandidates', () => {
  it('prefixa o tipo para não colidir com o estado de alerta do v1', () => {
    const candidates = deriveAlertCandidates(portfolioColony(sterileConduitsColony(), 21))
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates.every((c) => c.alertType.startsWith(V2_ALERT_PREFIX))).toBe(true)
  })

  it('insumo acabando vira alerta com o item e a hora', () => {
    const candidates = deriveAlertCandidates(portfolioColony(sterileConduitsColony(), 21))
    const supply = candidates.find((c) => c.kind === 'supply_out')
    expect(supply).toBeDefined()
    expect(supply!.typeName).toBe('Water')
    expect(supply!.inHours).toBeCloseTo(2, 6)
    expect(supply!.severity).toBe('amber')
  })

  it('saída morta gera alerta de COLÔNIA (pinId 0), não de pin', () => {
    const layout = sterileConduitsColony({ waterAmount: 4600 })
    layout.routes = layout.routes.filter((r) => r.content_type_id !== TYPE_STERILE_CONDUITS)
    const candidates = deriveAlertCandidates(portfolioColony(layout, 23.1))
    const stalled = candidates.find((c) => c.kind === 'stalled')
    expect(stalled).toBeDefined()
    expect(stalled!.pinId).toBe(0)
    expect(stalled!.severity).toBe('red')
  })

  it('NÃO alerta o ciclo normal: reposição no ritmo não vira notificação', () => {
    const candidates = deriveAlertCandidates(
      portfolioColony(sterileConduitsColony({ waterAmount: 5000 }), 21)
    )
    expect(candidates.some((c) => c.kind === 'restock_due')).toBe(false)
  })

  it('colônia saudável não gera alerta nenhum', () => {
    const candidates = deriveAlertCandidates(
      portfolioColony(sterileConduitsColony({ waterAmount: 20_000 }), 1)
    )
    expect(candidates).toEqual([])
  })

  it('um alerta por (tipo, pin) — nunca um por commodity', () => {
    const candidates = deriveAlertCandidates(portfolioColony(sterileConduitsColony(), 21))
    const keys = candidates.map((c) => `${c.alertType}:${c.pinId}`)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('dado passado de 72h vira alerta próprio, vermelho', () => {
    const candidates = deriveAlertCandidates(portfolioColony(sterileConduitsColony(), 100))
    const suspended = candidates.find((c) => c.kind === 'data_suspended')
    expect(suspended?.severity).toBe('red')
  })
})

describe('shouldNotify — cooldown', () => {
  const now = new Date('2026-07-30T12:00:00Z')
  const hoursAgo = (h: number) => new Date(now.getTime() - h * HOUR_MS)

  it('primeiro avistamento sempre notifica', () => {
    expect(shouldNotify(undefined, now, 24)).toBe(true)
  })

  it('problema aberto dentro do cooldown fica calado', () => {
    expect(shouldNotify({ lastNotifiedAt: hoursAgo(5), resolvedAt: null }, now, 24)).toBe(false)
  })

  it('problema aberto além do cooldown volta a avisar', () => {
    expect(shouldNotify({ lastNotifiedAt: hoursAgo(25), resolvedAt: null }, now, 24)).toBe(true)
  })

  it('problema que sumiu e voltou avisa na hora, mesmo dentro do cooldown', () => {
    // Uma segunda crise nunca pode ser silenciada pelo cooldown da primeira.
    expect(
      shouldNotify({ lastNotifiedAt: hoursAgo(1), resolvedAt: hoursAgo(0.5) }, now, 24)
    ).toBe(true)
  })
})

describe('resolveCooldownHrs', () => {
  it('acompanha a cadência — não avisa duas vezes entre duas visitas', () => {
    expect(resolveCooldownHrs(24)).toBe(24)
    expect(resolveCooldownHrs(48)).toBe(48)
  })

  it('tem piso de 6h para cadências muito curtas', () => {
    expect(resolveCooldownHrs(1)).toBe(6)
  })
})

describe('buildDigest — um ping por varredura, não 25', () => {
  const candidate = (over: Partial<AlertCandidate>): AlertCandidate => ({
    alertType: 'v2_supply_out',
    kind: 'supply_out',
    pinId: 500,
    severity: 'amber',
    planetId: 1,
    characterId: 9,
    planetName: 'P I',
    systemName: 'SYS',
    ...over,
  })

  it('sem candidatos não gera notificação', () => {
    expect(buildDigest([])).toBeNull()
  })

  it('25 planetas com problema viram UMA notificação', () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      candidate({ planetId: i + 1, planetName: `P ${i + 1}` })
    )
    const digest = buildDigest(many)
    expect(digest).not.toBeNull()
    expect(digest!.title).toContain('25 colônias')
    expect(digest!.content.split('\n')).toHaveLength(25)
  })

  it('destaca quantos são urgentes', () => {
    const digest = buildDigest([
      candidate({ planetId: 1, severity: 'red', kind: 'stalled' }),
      candidate({ planetId: 2, severity: 'red' }),
      candidate({ planetId: 3, severity: 'amber' }),
    ])
    expect(digest!.title).toContain('2 urgentes')
  })

  it('um planeta só nomeia o planeta e o problema', () => {
    const digest = buildDigest([candidate({ planetName: '6-IAFR I', kind: 'stalled' })])
    expect(digest!.title).toContain('6-IAFR I')
    expect(digest!.title).toContain('parada')
  })

  it('ordena vermelho antes de âmbar, e o mais próximo antes', () => {
    const digest = buildDigest([
      candidate({ planetId: 1, planetName: 'AMBER-LATE', severity: 'amber', inHours: 10 }),
      candidate({ planetId: 2, planetName: 'RED-ONE', severity: 'red', inHours: 0 }),
      candidate({ planetId: 3, planetName: 'AMBER-SOON', severity: 'amber', inHours: 1 }),
    ])
    const lines = digest!.content.split('\n')
    expect(lines[0]).toContain('RED-ONE')
    expect(lines[1]).toContain('AMBER-SOON')
    expect(lines[2]).toContain('AMBER-LATE')
  })
})
