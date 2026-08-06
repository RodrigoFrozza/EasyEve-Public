import {
  COLONY_LEVEL_PIN_ID,
  buildAlertMessage,
  deriveAlertCandidates,
  shouldNotify,
  type PiAlertCandidate,
  type PiPlanetAlertRecord,
} from '@/lib/pi/planet-alerts'
import type { PiBufferStatus, PiColonyAnalysis, PiExtractorView } from '@/lib/pi/types'

function bufferStatus(overrides: Partial<PiBufferStatus> = {}): PiBufferStatus {
  return { status: 'running', ...overrides }
}

function extractor(overrides: Partial<PiExtractorView> = {}): PiExtractorView {
  return {
    pinId: 1,
    productTypeId: 2073,
    productName: 'Water',
    qtyPerCycle: 100,
    cycleTimeSec: 3600,
    isExpired: false,
    designedUnitsPerHour: 100,
    currentUnitsPerHour: 100,
    ...overrides,
  }
}

function colony(overrides: Partial<PiColonyAnalysis> = {}): PiColonyAnalysis {
  return {
    planetId: 4001,
    characterId: 90000001,
    bufferStatusCurrent: bufferStatus(),
    extractors: [],
    ...overrides,
  } as PiColonyAnalysis
}

describe('deriveAlertCandidates', () => {
  it('emits nothing for a healthy colony', () => {
    expect(deriveAlertCandidates(colony())).toEqual([])
  })

  it('emits a red stalled candidate at colony level', () => {
    const c = colony({
      bufferStatusCurrent: bufferStatus({ status: 'stalled', limitingTypeId: 2073 }),
    })
    const candidates = deriveAlertCandidates(c)
    expect(candidates).toEqual([
      {
        alertType: 'stalled',
        pinId: COLONY_LEVEL_PIN_ID,
        typeId: 2073,
        typeName: expect.any(String),
        severity: 'red',
        planetId: 4001,
        characterId: 90000001,
      },
    ])
  })

  it('emits an amber degraded candidate at colony level (Fase B1)', () => {
    const c = colony({
      bufferStatusCurrent: bufferStatus({ status: 'degraded', limitingTypeId: 2073 }),
    })
    const [candidate] = deriveAlertCandidates(c)
    expect(candidate).toMatchObject({
      alertType: 'degraded',
      severity: 'amber',
      typeId: 2073,
      pinId: COLONY_LEVEL_PIN_ID,
    })
  })

  it('emits an amber starving_soon candidate with timeToStopHrs', () => {
    const c = colony({
      bufferStatusCurrent: bufferStatus({
        status: 'starving_soon',
        timeToStopHrs: 6.5,
        limitingTypeId: 2073,
      }),
    })
    const [candidate] = deriveAlertCandidates(c)
    expect(candidate).toMatchObject({
      alertType: 'starving_soon',
      severity: 'amber',
      timeToStopHrs: 6.5,
      pinId: COLONY_LEVEL_PIN_ID,
    })
  })

  it('emits an amber overflow_soon candidate with timeToFullHrs', () => {
    const c = colony({
      bufferStatusCurrent: bufferStatus({ status: 'overflow_soon', timeToFullHrs: 10 }),
    })
    const [candidate] = deriveAlertCandidates(c)
    expect(candidate).toMatchObject({
      alertType: 'overflow_soon',
      severity: 'amber',
      timeToFullHrs: 10,
    })
  })

  it('emits a red full candidate', () => {
    const c = colony({ bufferStatusCurrent: bufferStatus({ status: 'full' }) })
    const [candidate] = deriveAlertCandidates(c)
    expect(candidate).toMatchObject({ alertType: 'full', severity: 'red' })
  })

  it('emits one extractor_expired candidate per expired pin, ignoring healthy ones', () => {
    const c = colony({
      extractors: [
        extractor({ pinId: 10, isExpired: false }),
        extractor({ pinId: 11, isExpired: true, productTypeId: 2267, productName: 'Oxygen' }),
        extractor({ pinId: 12, isExpired: true, productTypeId: 2073, productName: 'Water' }),
      ],
    })
    const candidates = deriveAlertCandidates(c)
    expect(candidates).toHaveLength(2)
    expect(candidates).toEqual([
      expect.objectContaining({ alertType: 'extractor_expired', pinId: 11, typeId: 2267 }),
      expect.objectContaining({ alertType: 'extractor_expired', pinId: 12, typeId: 2073 }),
    ])
  })

  it('combines a buffer candidate and extractor candidates in the same colony', () => {
    const c = colony({
      bufferStatusCurrent: bufferStatus({ status: 'stalled' }),
      extractors: [extractor({ pinId: 20, isExpired: true })],
    })
    const candidates = deriveAlertCandidates(c)
    expect(candidates.map((a) => a.alertType)).toEqual(['stalled', 'extractor_expired'])
  })
})

describe('buildAlertMessage', () => {
  const place = { planetName: 'WE-KK2 II', systemName: 'WE-KK2' }

  it('formats a stalled message with the limiting commodity', () => {
    const candidate: PiAlertCandidate = {
      alertType: 'stalled',
      pinId: COLONY_LEVEL_PIN_ID,
      typeId: 2073,
      typeName: 'Water',
      severity: 'red',
      planetId: 4001,
      characterId: 90000001,
    }
    const msg = buildAlertMessage(candidate, place)
    expect(msg.title).toBe('PI: colônia parada')
    expect(msg.content).toContain('WE-KK2 II (WE-KK2)')
    expect(msg.content).toContain('Water')
  })

  it('formats a degraded message as attention, not catastrophe (Fase B1)', () => {
    const candidate: PiAlertCandidate = {
      alertType: 'degraded',
      pinId: COLONY_LEVEL_PIN_ID,
      typeId: 2073,
      typeName: 'Water',
      severity: 'amber',
      planetId: 4001,
      characterId: 90000001,
    }
    const msg = buildAlertMessage(candidate, place)
    expect(msg.title).toBe('PI: colônia degradada')
    expect(msg.content).toContain('WE-KK2 II (WE-KK2)')
    expect(msg.content).toContain('Water')
    expect(msg.content).toContain('abaixo do desenhado')
  })

  it('formats a starving_soon message with rounded hours', () => {
    const candidate: PiAlertCandidate = {
      alertType: 'starving_soon',
      pinId: COLONY_LEVEL_PIN_ID,
      severity: 'amber',
      timeToStopHrs: 6.7,
      planetId: 4001,
      characterId: 90000001,
    }
    const msg = buildAlertMessage(candidate, place)
    expect(msg.content).toContain('~7h')
  })

  it('formats an extractor_expired message with the pin id', () => {
    const candidate: PiAlertCandidate = {
      alertType: 'extractor_expired',
      pinId: 12,
      typeId: 2073,
      typeName: 'Water',
      severity: 'red',
      planetId: 4001,
      characterId: 90000001,
    }
    const msg = buildAlertMessage(candidate, place)
    expect(msg.content).toContain('pin 12')
    expect(msg.content).toContain('Water')
  })
})

describe('shouldNotify', () => {
  const now = new Date('2026-07-18T12:00:00Z')

  it('notifies when there is no existing record', () => {
    expect(shouldNotify(undefined, now, 24)).toBe(true)
  })

  it('notifies immediately when the previous occurrence was resolved (retrigger)', () => {
    const existing: PiPlanetAlertRecord = {
      lastNotifiedAt: new Date('2026-07-18T11:59:00Z'), // 1 minute ago, well inside cooldown
      resolvedAt: new Date('2026-07-18T11:59:30Z'),
    }
    expect(shouldNotify(existing, now, 24)).toBe(true)
  })

  it('silences a still-open alert inside the cooldown window', () => {
    const existing: PiPlanetAlertRecord = {
      lastNotifiedAt: new Date('2026-07-18T02:00:00Z'), // 10h ago
      resolvedAt: null,
    }
    expect(shouldNotify(existing, now, 24)).toBe(false)
  })

  it('re-notifies a still-open alert once the cooldown has elapsed', () => {
    const existing: PiPlanetAlertRecord = {
      lastNotifiedAt: new Date('2026-07-17T11:00:00Z'), // 25h ago
      resolvedAt: null,
    }
    expect(shouldNotify(existing, now, 24)).toBe(true)
  })

  it('treats exactly-at-cooldown as due', () => {
    const existing: PiPlanetAlertRecord = {
      lastNotifiedAt: new Date('2026-07-17T12:00:00Z'), // exactly 24h ago
      resolvedAt: null,
    }
    expect(shouldNotify(existing, now, 24)).toBe(true)
  })
})
