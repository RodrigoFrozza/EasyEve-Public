/**
 * O papel do container decide em que conta o estoque entra: `'buy'` desconta a
 * lista de compra, `'sell'` é backlog de venda. Misturar os dois faria a lista
 * pedir de menos (PI pronto para vender contado como insumo em mãos) — por isso o
 * mesmo inventário é lido pelos dois lados aqui e cada um só pode ver o seu.
 */

import { readSaleContainers, readWarehouse } from '@/lib/pi-v2/warehouse-service'
import { getCharacterAssets } from '@/lib/pi-v2/host'
import type { EsiAssetItem, WarehouseContainerConfig } from '@/lib/pi-v2/warehouse'

jest.mock('@/lib/pi-v2/host', () => ({
  getCharacterAssets: jest.fn(),
  getCharacterAssetNames: jest.fn(),
  getStructureNamesBatch: jest.fn(),
  hasAssetReadScope: () => true,
  safeDecryptToken: (token: string | null | undefined) => token ?? null,
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}))

const BASE = 60_003_760 // UALX-3
const WATER = 3645 // P1 — insumo
const STERILE = 2875 // P4 — vendido por contrato
const CONTAINER_TYPE = 3465
const CHAR = 90_001

const BUY_BOX = 1000
const SELL_BOX = 2000

const asset = (itemId: number, locationId: number, typeId: number, quantity = 1): EsiAssetItem => ({
  item_id: itemId,
  location_id: locationId,
  type_id: typeId,
  quantity,
})

const assets: EsiAssetItem[] = [
  asset(BUY_BOX, BASE, CONTAINER_TYPE),
  asset(1001, BUY_BOX, WATER, 5000),
  asset(SELL_BOX, BASE, CONTAINER_TYPE),
  asset(2001, SELL_BOX, STERILE, 40),
  asset(2002, SELL_BOX, WATER, 300), // sobra de insumo guardada no container de venda
]

const config: WarehouseContainerConfig[] = [
  { itemId: BUY_BOX, characterId: CHAR, name: 'Insumos', role: 'buy' },
  { itemId: SELL_BOX, characterId: CHAR, name: 'Venda', role: 'sell' },
]

const characters = [{ id: CHAR, name: 'Zeca', accessToken: 'token' }]

beforeEach(() => {
  ;(getCharacterAssets as jest.Mock).mockResolvedValue(assets)
})

describe('readWarehouse — só o lado compra desconta a lista', () => {
  it('ignora o container de venda, mesmo com insumo dentro dele', async () => {
    const view = await readWarehouse({
      characters,
      config,
      consumptionPerHour: new Map(),
      cadenceHrs: 24,
    })
    expect(view.stock[WATER]).toBe(5000)
    expect(view.stock[STERILE]).toBeUndefined()
    expect(view.containers.map((c) => c.itemId)).toEqual([BUY_BOX])
  })

  it('config antiga, sem `role`, continua valendo como compra', async () => {
    const view = await readWarehouse({
      characters,
      config: [{ itemId: BUY_BOX, characterId: CHAR, name: 'Insumos' }],
      consumptionPerHour: new Map(),
      cadenceHrs: 24,
    })
    expect(view.stock[WATER]).toBe(5000)
  })
})

describe('readSaleContainers — só o lado venda, só a lista fechada', () => {
  it('lê só o container de venda e só os itens rastreados de venda', async () => {
    const result = await readSaleContainers({ characters, config })
    expect(result.byType).toEqual({ [STERILE]: 40 })
    expect(result.containers.map((c) => c.itemId)).toEqual([SELL_BOX])
    expect(result.incomplete).toBe(false)
  })
})
