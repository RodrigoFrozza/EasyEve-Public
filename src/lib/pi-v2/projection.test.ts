import {
  bandAllowsProjection,
  elapsedHoursSince,
  projectStock,
  resolveConfidence,
  stalenessBand,
} from '@/lib/pi-v2/projection'
import { isEnvFlagEnabledFor } from '@/lib/pi-v2/flag'

describe('projectStock', () => {
  it('avança a drenagem real da 6-IAFR I (4.6K − 200/h por 21h → ~400)', () => {
    expect(projectStock(4600, -200, 21)).toBeCloseTo(400, 6)
  })

  it('satura no piso, nunca vai negativo', () => {
    expect(projectStock(100, -200, 21)).toBe(0)
  })

  it('satura no teto quando maxUnits é dado', () => {
    expect(projectStock(0, 72, 10, { maxUnits: 500 })).toBe(500)
  })

  it('acumula abaixo do teto sem saturar', () => {
    expect(projectStock(0, 72, 5, { maxUnits: 500 })).toBe(360)
  })

  it('elapsed <= 0 devolve o snapshot inalterado (sem projeção)', () => {
    expect(projectStock(4600, -200, 0)).toBe(4600)
    expect(projectStock(4600, -200, -5)).toBe(4600)
  })

  it('elapsed não-finito devolve o snapshot inalterado', () => {
    expect(projectStock(4600, -200, Number.NaN)).toBe(4600)
    expect(projectStock(4600, -200, Number.POSITIVE_INFINITY)).toBe(4600)
  })
})

describe('elapsedHoursSince', () => {
  it('calcula horas desde o lastUpdate', () => {
    const now = Date.parse('2026-07-20T20:38:00Z') + 21 * 3_600_000
    expect(elapsedHoursSince('2026-07-20T20:38:00Z', now)).toBeCloseTo(21, 6)
  })

  it('lastUpdate ausente ou inválido → 0 (snapshot inalterado)', () => {
    expect(elapsedHoursSince(undefined, Date.now())).toBe(0)
    expect(elapsedHoursSince('not-a-date', Date.now())).toBe(0)
  })

  it('nunca devolve horas negativas (snapshot no futuro → 0)', () => {
    const past = Date.parse('2026-07-20T20:38:00Z') - 3_600_000
    expect(elapsedHoursSince('2026-07-20T20:38:00Z', past)).toBe(0)
  })
})

describe('stalenessBand', () => {
  it('classifica cada banda', () => {
    expect(stalenessBand(0.5)).toBe('live')
    expect(stalenessBand(5)).toBe('estimated')
    expect(stalenessBand(48)).toBe('diverging')
    expect(stalenessBand(100)).toBe('suspended')
  })

  it('respeita os limites das bandas', () => {
    expect(stalenessBand(0.99)).toBe('live')
    expect(stalenessBand(1)).toBe('estimated')
    expect(stalenessBand(23.99)).toBe('estimated')
    expect(stalenessBand(24)).toBe('diverging')
    expect(stalenessBand(72)).toBe('diverging')
    expect(stalenessBand(72.01)).toBe('suspended')
  })

  it('suspende a projeção somente acima de 72h', () => {
    expect(bandAllowsProjection('live')).toBe(true)
    expect(bandAllowsProjection('estimated')).toBe(true)
    expect(bandAllowsProjection('diverging')).toBe(true)
    expect(bandAllowsProjection('suspended')).toBe(false)
  })
})

describe('resolveConfidence', () => {
  const anchor = '2026-07-20T20:38:00Z'
  const anchorMs = Date.parse(anchor)

  it('monta o selo e libera a projeção dentro das bandas válidas', () => {
    const c = resolveConfidence(anchor, anchorMs + 21 * 3_600_000)
    expect(c.ageHours).toBeCloseTo(21, 6)
    expect(c.band).toBe('estimated')
    expect(c.anchorIso).toBe(anchor)
    expect(c.projectionApplied).toBe(true)
    expect(c.effectiveElapsedHrs).toBeCloseTo(21, 6)
  })

  it('acima de 72h suspende a projeção mas PRESERVA a idade real', () => {
    const c = resolveConfidence(anchor, anchorMs + 100 * 3_600_000)
    expect(c.band).toBe('suspended')
    expect(c.projectionApplied).toBe(false)
    expect(c.effectiveElapsedHrs).toBe(0) // não avança estoque
    expect(c.ageHours).toBeCloseTo(100, 6) // mas continua sabendo que está velho
  })

  it('sem âncora não projeta nada e diz que não projetou', () => {
    const c = resolveConfidence(undefined, Date.now())
    expect(c.projectionApplied).toBe(false)
    expect(c.effectiveElapsedHrs).toBe(0)
    expect(c.ageHours).toBe(0)
  })
})

describe('isEnvFlagEnabledFor', () => {
  it('desligado por padrão (env ausente/vazia/off)', () => {
    expect(isEnvFlagEnabledFor(undefined, 'u1')).toBe(false)
    expect(isEnvFlagEnabledFor('', 'u1')).toBe(false)
    expect(isEnvFlagEnabledFor('0', 'u1')).toBe(false)
    expect(isEnvFlagEnabledFor('false', 'u1')).toBe(false)
    expect(isEnvFlagEnabledFor('off', 'u1')).toBe(false)
  })

  it('ligado globalmente', () => {
    expect(isEnvFlagEnabledFor('1', 'u1')).toBe(true)
    expect(isEnvFlagEnabledFor('true', 'u1')).toBe(true)
    expect(isEnvFlagEnabledFor('on', 'u1')).toBe(true)
    expect(isEnvFlagEnabledFor('all', 'u1')).toBe(true)
  })

  it('allowlist por userId (rollout só para o Rodrigo primeiro)', () => {
    expect(isEnvFlagEnabledFor('u1', 'u1')).toBe(true)
    expect(isEnvFlagEnabledFor('u1, u2', 'u2')).toBe(true)
    expect(isEnvFlagEnabledFor('u1,u2', 'u3')).toBe(false)
  })
})
