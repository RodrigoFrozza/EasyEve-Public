import { act, renderHook } from '@testing-library/react'
import { MAX_STRUCTURE_HUBS, usePiV2ViewPrefs } from '@/lib/hooks/use-pi-v2-view-prefs'
import { JITA_HUB_ID, REGION_HUB_ID } from '@/lib/pi-v2/pricing/freight-model'

const STORAGE_KEY = 'pi-v2:viewPrefs'
const BACKUP_KEY = 'pi-v2:viewPrefs.pre-etapa8'

/** A config real das Etapas 5/7: UALX é a base, C-J6 tem contrato, Jita tem taxa. */
const LEGACY_STORED = {
  groupByCharacter: false,
  shoppingPeriodHrs: 168,
  buyStations: [
    { id: '60003760', name: 'UALX-3', freightPerM3: 0, freightMode: 'local' },
    {
      id: '61000001',
      name: 'C-J6MT',
      freightPerM3: 800,
      freightMode: 'contract',
      contract: { transporter: 'ITL', perM3Rate: 800, minReward: 20_000_000 },
    },
  ],
  jitaFreightPerM3: 800,
}

const read = () => JSON.parse(window.localStorage.getItem(STORAGE_KEY)!)

describe('usePiV2ViewPrefs', () => {
  beforeEach(() => window.localStorage.clear())

  it('agrupa por personagem por default — é assim que se joga', () => {
    const { result } = renderHook(() => usePiV2ViewPrefs())
    expect(result.current.groupByCharacter).toBe(true)
  })

  it('o toggle persiste em localStorage', () => {
    const { result } = renderHook(() => usePiV2ViewPrefs())
    act(() => result.current.setGroupByCharacter(false))

    expect(result.current.groupByCharacter).toBe(false)
    expect(read().groupByCharacter).toBe(false)
  })

  it('começa sem base e sem frete configurado — nunca um número inventado', () => {
    const { result } = renderHook(() => usePiV2ViewPrefs())
    expect(result.current.baseHub).toBeNull()
    expect(result.current.shoppingPeriodHrs).toBe(24)
    // As duas fontes públicas existem sempre, mas sem perna.
    expect(result.current.hubs.map((h) => h.id)).toEqual([REGION_HUB_ID, JITA_HUB_ID])
    expect(result.current.hubs.every((h) => !h.inbound)).toBe(true)
  })

  it('período, base e hubs persistem, sem apagar as outras prefs', () => {
    const { result } = renderHook(() => usePiV2ViewPrefs())
    act(() => result.current.setGroupByCharacter(false))
    act(() => result.current.setShoppingPeriodHrs(168))
    act(() => result.current.setBaseHub({ id: '60003760', name: 'UALX-3' }))
    act(() =>
      result.current.setHubs([
        ...result.current.hubs,
        {
          id: '61000001',
          name: 'C-J6MT',
          inbound: { method: 'jf', jfTypeId: 28844, isotopeQtyRoundTrip: 12_000, cargoM3: 144_000 },
        },
      ])
    )

    const stored = read()
    expect(stored.groupByCharacter).toBe(false)
    expect(stored.shoppingPeriodHrs).toBe(168)
    expect(stored.baseHub).toEqual({ id: '60003760', name: 'UALX-3' })
    expect(stored.hubs.find((h: { id: string }) => h.id === '61000001').inbound).toMatchObject({
      method: 'jf',
      jfTypeId: 28844,
      isotopeQtyRoundTrip: 12_000,
    })
  })

  it('definir a base tira aquela estação da lista de hubs', () => {
    // Se ela ficasse nos dois lugares, concorreria consigo mesma na escolha por
    // custo efetivo — com dois fretes diferentes.
    const { result } = renderHook(() => usePiV2ViewPrefs())
    act(() =>
      result.current.setHubs([
        ...result.current.hubs,
        { id: '60003760', name: 'UALX-3', inbound: { method: 'courier', transporter: 'ITL', perM3Rate: 50 } },
      ])
    )
    act(() => result.current.setBaseHub({ id: '60003760', name: 'UALX-3' }))

    expect(result.current.hubs.some((h) => h.id === '60003760')).toBe(false)
    expect(result.current.baseHub).toEqual({ id: '60003760', name: 'UALX-3' })
  })

  it('respeita o teto de hubs de estrutura, sem perder os públicos', () => {
    const { result } = renderHook(() => usePiV2ViewPrefs())
    act(() =>
      result.current.setHubs(
        Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, name: `S${i}` }))
      )
    )
    const structures = result.current.hubs.filter(
      (h) => h.id !== REGION_HUB_ID && h.id !== JITA_HUB_ID
    )
    expect(structures).toHaveLength(MAX_STRUCTURE_HUBS)
    expect(result.current.hubs).toHaveLength(MAX_STRUCTURE_HUBS + 2)
  })

  describe('memória de contrato por rota + transportadora', () => {
    it('lembra o último contrato e devolve na próxima', () => {
      const { result } = renderHook(() => usePiV2ViewPrefs())
      const contract = { transporter: 'ITL', perM3Rate: 850, minReward: 20_000_000 }
      act(() => result.current.rememberContract('60003760', contract))
      expect(result.current.recallContract('60003760', 'ITL')).toEqual(contract)
    })

    it('a memória é por rota E por transportadora', () => {
      const { result } = renderHook(() => usePiV2ViewPrefs())
      act(() => result.current.rememberContract('A', { transporter: 'ITL', perM3Rate: 850 }))
      act(() => result.current.rememberContract('A', { transporter: 'GDSO', perM3Rate: 800 }))
      expect(result.current.recallContract('A', 'GDSO')?.perM3Rate).toBe(800)
      expect(result.current.recallContract('A', 'ITL')?.perM3Rate).toBe(850)
      // Outra rota não herda o contrato.
      expect(result.current.recallContract('B', 'ITL')).toBeUndefined()
    })

    it('o nome da transportadora não distingue por caixa ou espaço', () => {
      const { result } = renderHook(() => usePiV2ViewPrefs())
      act(() => result.current.rememberContract('A', { transporter: ' ITL ', perM3Rate: 850 }))
      expect(result.current.recallContract('A', 'itl')?.perM3Rate).toBe(850)
    })

    it('sem transportadora nomeada não guarda nada', () => {
      const { result } = renderHook(() => usePiV2ViewPrefs())
      act(() => result.current.rememberContract('A', { transporter: '', perM3Rate: 850 }))
      expect(result.current.recallContract('A', '')).toBeUndefined()
    })
  })

  describe('teste 6 — migração da config das Etapas 5/7', () => {
    it('lê base + hubs a partir do formato antigo, sem perder nada', () => {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(LEGACY_STORED))
      const { result } = renderHook(() => usePiV2ViewPrefs())

      expect(result.current.baseHub).toEqual({ id: '60003760', name: 'UALX-3' })
      expect(result.current.shoppingPeriodHrs).toBe(168)
      expect(result.current.groupByCharacter).toBe(false)

      const cj6 = result.current.hubs.find((h) => h.id === '61000001')!
      expect(cj6.inbound).toMatchObject({
        method: 'courier',
        transporter: 'ITL',
        perM3Rate: 800,
        minReward: 20_000_000,
      })
      expect(result.current.hubs.find((h) => h.id === JITA_HUB_ID)!.inbound).toMatchObject({
        perM3Rate: 800,
      })
    })

    it('guarda o formato antigo num backup antes de o novo substituí-lo', () => {
      // Config de frete é trabalho manual do jogador. Sobrescrever o único
      // registro dela sem rede de segurança destruiria dado irrecuperável.
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(LEGACY_STORED))
      renderHook(() => usePiV2ViewPrefs())
      expect(JSON.parse(window.localStorage.getItem(BACKUP_KEY)!)).toEqual(LEGACY_STORED)
    })

    it('config nova não gera backup — não há o que preservar', () => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ baseHub: { id: '1', name: 'X' }, hubs: [] })
      )
      renderHook(() => usePiV2ViewPrefs())
      expect(window.localStorage.getItem(BACKUP_KEY)).toBeNull()
    })
  })

  describe('semeadura do formato mais antigo (ids vinham do servidor)', () => {
    it('preserva o frete das duas estruturas fixas', () => {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          shoppingPeriodHrs: 48,
          freight: { structure: 0, structure2: 208, region: 0, jita: 800 },
        })
      )
      const { result } = renderHook(() => usePiV2ViewPrefs())

      // Os fretes públicos migram sozinhos.
      expect(result.current.hubs.find((h) => h.id === JITA_HUB_ID)!.inbound).toMatchObject({
        perM3Rate: 800,
      })
      expect(result.current.hubs.find((h) => h.id === REGION_HUB_ID)!.inbound).toBeUndefined()

      act(() =>
        result.current.seedFromLegacy([
          { id: '60003760', name: 'UALX-3 - Mothership Bellicose' },
          { id: '60003761', name: 'C-J6MT' },
        ])
      )

      expect(result.current.baseHub).toEqual({
        id: '60003760',
        name: 'UALX-3 - Mothership Bellicose',
      })
      expect(result.current.hubs.find((h) => h.id === '60003761')!.inbound).toMatchObject({
        method: 'courier',
        perM3Rate: 208,
      })
      // E o frete de Jita que já havia migrado continua lá.
      expect(result.current.hubs.find((h) => h.id === JITA_HUB_ID)!.inbound).toMatchObject({
        perM3Rate: 800,
      })
    })

    it('não sobrescreve a config que o jogador já montou', () => {
      const { result } = renderHook(() => usePiV2ViewPrefs())
      act(() => result.current.setBaseHub({ id: '9', name: 'Minha base' }))
      act(() => result.current.seedFromLegacy([{ id: '1', name: 'Antiga' }]))
      expect(result.current.baseHub).toEqual({ id: '9', name: 'Minha base' })
      expect(result.current.hubs.some((h) => h.id === '1')).toBe(false)
    })

    it('sem estruturas antigas, não inventa hub', () => {
      const { result } = renderHook(() => usePiV2ViewPrefs())
      act(() => result.current.seedFromLegacy([]))
      expect(result.current.baseHub).toBeNull()
      expect(result.current.hubs.map((h) => h.id)).toEqual([REGION_HUB_ID, JITA_HUB_ID])
    })
  })

  it('storage corrompido cai no default em vez de quebrar a tela', () => {
    window.localStorage.setItem(STORAGE_KEY, 'não é json')
    const { result } = renderHook(() => usePiV2ViewPrefs())
    expect(result.current.groupByCharacter).toBe(true)
    expect(result.current.baseHub).toBeNull()
  })
})
