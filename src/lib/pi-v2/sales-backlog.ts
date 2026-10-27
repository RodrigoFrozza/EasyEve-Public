/**
 * Backlog de venda de PI (Frente 2) — quanto PI pronto está parado sem virar ISK.
 *
 * Duas metades do mesmo número, e as duas precisam entrar ou o total mente por
 * omissão: itens em container de venda (`role: 'sell'`, ver warehouse.ts) somados
 * a itens em contratos PRÓPRIOS ainda `outstanding`. Um cliente fixo que já levou
 * o item pra contrato some do container — contar só container faria aquele pedaço
 * do backlog parecer "vendido" quando só está parado esperando aceite.
 *
 * Escopo desta fatia: só QUANTIDADE. Valorar (ISK) exige o pipeline de order book
 * inteiro (`composePriceMap`, que busca book real de região/Jita/estruturas) — caro
 * demais pra plugar numa tela de prioridade baixa sem uma tela que já dispare essa
 * busca. Melhor mostrar quantidade certa agora do que inventar um preço aproximado
 * em silêncio (regra de ouro do projeto). Fica pra fatia futura, condicionada ao
 * custo real de adicionar mais uma varredura de book.
 *
 * Puro: recebe estoque e contratos já buscados, devolve números. Sem ESI aqui.
 */

import { getCommodityName } from '@/lib/pi-v2/sde'
import { isSaleTrackedItem } from '@/lib/pi-v2/sale-items'

/** Um item dentro de um contrato próprio, já resolvido via `/contracts/{id}/items/`. */
export interface OwnContractItem {
  typeId: number
  quantity: number
}

/**
 * Um contrato próprio relevante: `issuer` é o Rodrigo, `type=item_exchange`,
 * `status=outstanding`. Contratos de outro tipo/status nem chegam aqui — o filtro
 * é responsabilidade de quem busca (rota `/api/pi-v2/contracts`).
 */
export interface OwnOutstandingContract {
  contractId: number
  characterId: number
  items: OwnContractItem[]
}

export interface BuildSalesBacklogInput {
  /** typeId → quantidade, já filtrado a containers `role: 'sell'`. */
  containerStock: Record<number, number>
  /** Algum container de venda não pôde ser lido — o número fica PARCIAL. */
  containerIncomplete: boolean
  contracts: OwnOutstandingContract[]
  /** Personagens cujo contrato não pôde ser buscado — o número fica PARCIAL. */
  contractsIncomplete: boolean
}

export interface SalesBacklogItem {
  typeId: number
  name: string
  containerQty: number
  contractQty: number
  totalQty: number
}

export interface SalesBacklog {
  items: SalesBacklogItem[]
  /** Container OU contrato não puderam ser lidos por completo — número PARCIAL. */
  incomplete: boolean
}

export function buildSalesBacklog(input: BuildSalesBacklogInput): SalesBacklog {
  const { containerStock, containerIncomplete, contracts, contractsIncomplete } = input

  const containerQtyByType = new Map<number, number>()
  for (const [typeIdRaw, quantity] of Object.entries(containerStock)) {
    const typeId = Number(typeIdRaw)
    if (!isSaleTrackedItem(typeId)) continue
    containerQtyByType.set(typeId, (containerQtyByType.get(typeId) ?? 0) + quantity)
  }

  const contractQtyByType = new Map<number, number>()
  for (const contract of contracts) {
    for (const item of contract.items) {
      if (!isSaleTrackedItem(item.typeId)) continue
      contractQtyByType.set(
        item.typeId,
        (contractQtyByType.get(item.typeId) ?? 0) + item.quantity
      )
    }
  }

  const typeIds = new Set<number>([...containerQtyByType.keys(), ...contractQtyByType.keys()])

  const items: SalesBacklogItem[] = []
  for (const typeId of typeIds) {
    const containerQty = containerQtyByType.get(typeId) ?? 0
    const contractQty = contractQtyByType.get(typeId) ?? 0
    items.push({
      typeId,
      name: getCommodityName(typeId),
      containerQty,
      contractQty,
      totalQty: containerQty + contractQty,
    })
  }

  items.sort((a, b) => b.totalQty - a.totalQty || a.name.localeCompare(b.name))

  return {
    items,
    incomplete: containerIncomplete || contractsIncomplete,
  }
}
