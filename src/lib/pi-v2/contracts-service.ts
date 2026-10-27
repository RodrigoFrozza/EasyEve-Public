/**
 * Camada de dados dos contratos próprios — a metade "contrato" do backlog de
 * venda (Frente 2, ver `sales-backlog.ts`).
 *
 * A ESI só devolve status/tipo/datas na lista (`/characters/{id}/contracts/`); o
 * item de cada contrato exige uma chamada extra em `/contracts/{id}/items/`. Pra
 * não pagar essa chamada de novo a cada abertura de aba — a composição de um
 * contrato NUNCA muda depois de criado — o CLIENTE guarda um cache
 * (`contract_id` → itens) em localStorage e manda os ids já conhecidos. Só os que
 * faltam são buscados aqui; os novos voltam pro client mesclar no cache dele.
 *
 * Falha nunca é invisível: sem o scope, ou com a busca falhando, o personagem sai
 * do resultado mas o backlog fica marcado `incomplete` — nunca vira zero calado.
 */

import {
  getCharacterContractItems,
  getCharacterContractsList,
  hasContractReadScope,
  logger,
  safeDecryptToken,
} from '@/lib/pi-v2/host'
import type { OwnContractItem, OwnOutstandingContract } from '@/lib/pi-v2/sales-backlog'

export type { OwnContractItem, OwnOutstandingContract }

export interface ContractsCharacter {
  id: number
  name: string
  accessToken?: string | null
}

/** Um contrato como a ESI devolve, reduzido ao que este módulo usa. */
interface EsiContract {
  contract_id: number
  type: string
  status: string
  issuer_id: number
}

interface EsiContractItem {
  type_id: number
  quantity: number
  is_included: boolean
}

export interface ReadOwnContractsInput {
  characters: ContractsCharacter[]
  /** `contract_id` → itens já resolvidos em rodadas anteriores (cache do client). */
  knownItemsByContractId: Map<number, OwnContractItem[]>
}

export interface ReadOwnContractsResult {
  contracts: OwnOutstandingContract[]
  /** `contract_id` → itens: só os que faltavam no cache, pro client mesclar. */
  newItemsByContractId: Map<number, OwnContractItem[]>
  /** Algum personagem sem scope ou com a busca falhando — o backlog fica PARCIAL. */
  incomplete: boolean
}

/**
 * Busca os contratos próprios `outstanding` (venda em aberto) de cada personagem.
 *
 * Filtra `type === 'item_exchange'` e `issuer_id === character.id`: a lista da
 * ESI também devolve contratos onde o personagem é ACEITANTE (ele comprando de
 * outra pessoa) — isso não é backlog de venda, é o oposto, e contaria errado se
 * não fosse filtrado.
 */
export async function readOwnContracts(
  input: ReadOwnContractsInput
): Promise<ReadOwnContractsResult> {
  const { characters, knownItemsByContractId } = input

  let incomplete = false
  const contracts: OwnOutstandingContract[] = []
  const newItemsByContractId = new Map<number, OwnContractItem[]>()

  await Promise.all(
    characters.map(async (character) => {
      if (!hasContractReadScope(safeDecryptToken(character.accessToken) ?? '')) {
        incomplete = true
        return
      }

      let list: EsiContract[]
      try {
        list = (await getCharacterContractsList(character.id)) as EsiContract[]
      } catch (error) {
        logger.warn('PiV2Contracts', `Contratos do personagem ${character.id} falharam`, error)
        incomplete = true
        return
      }

      const outstanding = list.filter(
        (c) =>
          c.type === 'item_exchange' && c.status === 'outstanding' && c.issuer_id === character.id
      )

      for (const contract of outstanding) {
        const cached = knownItemsByContractId.get(contract.contract_id)
        let items: OwnContractItem[]

        if (cached) {
          items = cached
        } else {
          try {
            const raw = (await getCharacterContractItems(
              character.id,
              contract.contract_id
            )) as EsiContractItem[]
            items = raw
              .filter((i) => i.is_included)
              .map((i) => ({ typeId: i.type_id, quantity: i.quantity }))
          } catch (error) {
            logger.warn(
              'PiV2Contracts',
              `Itens do contrato ${contract.contract_id} (personagem ${character.id}) falharam`,
              error
            )
            incomplete = true
            continue
          }
          newItemsByContractId.set(contract.contract_id, items)
        }

        contracts.push({ contractId: contract.contract_id, characterId: character.id, items })
      }
    })
  )

  return { contracts, newItemsByContractId, incomplete }
}
