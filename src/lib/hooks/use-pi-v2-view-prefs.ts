'use client'

import { useCallback, useEffect, useState } from 'react'
import type { ContractFreight } from '@/lib/pi-v2/pricing/freight'
import type { WarehouseContainerConfig } from '@/lib/pi-v2/warehouse'
import {
  isPublicHubId,
  type BaseHub,
  type FreightHub,
  type FreightLeg,
} from '@/lib/pi-v2/pricing/freight-model'
import {
  MAX_STRUCTURE_HUBS,
  readFreightPrefs,
  readLegacyStructureRates,
  seedHubsFromLegacy,
  withPublicHubs,
} from '@/lib/pi-v2/freight-prefs'

export type { ContractFreight }
export type { BaseHub, FreightHub, FreightLeg, WarehouseContainerConfig }
export { MAX_STRUCTURE_HUBS }

/**
 * Preferências de exibição do PI v2, só do cliente. Vivem em localStorage — sem
 * migração de banco, sem risco para o carregamento de config, e alternam na hora.
 *
 * Chave própria (`pi-v2:`) para não colidir com as prefs do módulo antigo
 * enquanto os dois convivem.
 *
 * O frete mora aqui como **base central + hubs**: uma base onde o PI se junta e N
 * hubs, cada um com a perna de entrada (hub → base) que o jogador escolheu. A
 * perna de SAÍDA (base → hub) já existe no tipo e é preservada na leitura e na
 * gravação, mas não tem UI nesta etapa — ela entra com o P&L. O modelo nasce
 * completo para a migração não ter que rodar duas vezes.
 */
export type PiV2ViewPrefs = {
  /**
   * Agrupar o portfólio por personagem. Ligado por default porque é assim que se
   * joga: loga num personagem, resolve os planetas dele, sai, entra no próximo.
   * Uma lista plana ordenada por urgência global obrigaria a trocar de conta a
   * cada linha.
   */
  groupByCharacter: boolean
  /** Período da lista de compra, em horas. */
  shoppingPeriodHrs: number
  /**
   * A base central: onde ele junta todo o PI. Destino de toda entrada, e o único
   * hub cujo frete é 0 de verdade.
   */
  baseHub: BaseHub | null
  /**
   * Hubs de compra. Estruturas onde ele pode atracar (a busca da ESI só devolve
   * essas) mais as duas fontes públicas, que estão sempre presentes.
   */
  hubs: FreightHub[]
  /**
   * Containers designados como Armazém de PI. Vazio = feature desligada: nenhuma
   * leitura de assets acontece.
   *
   * Mora aqui, junto da base, pelo mesmo motivo: é config de uma pessoa, afeta só
   * esta análise, e adiar o schema mantém a entrega reversível.
   */
  warehouseContainers: WarehouseContainerConfig[]
}

const STORAGE_KEY = 'pi-v2:viewPrefs'
/**
 * Cópia do formato anterior, guardada UMA vez, no instante em que a migração
 * grava o formato novo. Config de frete é trabalho manual do jogador (ele
 * consultou a transportadora e digitou os números); sobrescrever o único registro
 * dela sem rede de segurança seria destruir dado que não dá para recuperar.
 */
const BACKUP_KEY = 'pi-v2:viewPrefs.pre-etapa8'

const DEFAULTS: PiV2ViewPrefs = {
  groupByCharacter: true,
  shoppingPeriodHrs: 24,
  baseHub: null,
  hubs: withPublicHubs([]),
  warehouseContainers: [],
}

/**
 * Containers do armazém guardados. Entrada sem `itemId` ou sem `characterId` é
 * descartada: sem os dois não há o que procurar nos assets, e adivinhar o dono
 * somaria o estoque de outro personagem.
 */
function readWarehouseContainers(raw: unknown): WarehouseContainerConfig[] {
  if (!Array.isArray(raw)) return []
  const out: WarehouseContainerConfig[] = []
  for (const entry of raw) {
    const e = entry as Record<string, unknown> | null
    const itemId = Number(e?.itemId)
    const characterId = Number(e?.characterId)
    if (!Number.isFinite(itemId) || itemId <= 0) continue
    if (!Number.isFinite(characterId) || characterId <= 0) continue
    out.push({
      itemId,
      characterId,
      name: typeof e?.name === 'string' && e.name.trim() ? e.name.trim() : `#${itemId}`,
      locationName:
        typeof e?.locationName === 'string' && e.locationName.trim()
          ? e.locationName.trim()
          : undefined,
    })
  }
  return out
}

function readStored(): PiV2ViewPrefs {
  if (typeof window === 'undefined') return DEFAULTS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const period = Number(parsed.shoppingPeriodHrs)
    const freight = readFreightPrefs(parsed)

    // A migração grava o backup antes de o formato novo substituir o antigo.
    if (freight.migrated && !window.localStorage.getItem(BACKUP_KEY)) {
      try {
        window.localStorage.setItem(BACKUP_KEY, raw)
      } catch {
        // ignora falha de storage — a leitura em si não perde nada
      }
    }

    return {
      groupByCharacter:
        typeof parsed.groupByCharacter === 'boolean'
          ? parsed.groupByCharacter
          : DEFAULTS.groupByCharacter,
      shoppingPeriodHrs:
        Number.isFinite(period) && period > 0 ? period : DEFAULTS.shoppingPeriodHrs,
      baseHub: freight.baseHub,
      hubs: freight.hubs,
      warehouseContainers: readWarehouseContainers(parsed.warehouseContainers),
    }
  } catch {
    return DEFAULTS
  }
}

/**
 * Memória de contratos por (rota, transportadora).
 *
 * O jogador consulta o site do courier e digita os números. Da próxima vez que
 * escolher aquela transportadora naquela rota, vem preenchido — reconsultar e
 * redigitar a cada rodada é exatamente o tipo de trabalho manual que o módulo
 * existe para tirar.
 *
 * "Rota" aqui é o hub de origem: o destino é sempre a base do jogador.
 */
const CONTRACTS_KEY = 'pi-v2:freightContracts'

function contractKey(hubId: string, transporter: string): string {
  return `${hubId}::${transporter.trim().toLowerCase()}`
}

function readContractMemory(): Record<string, ContractFreight> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(CONTRACTS_KEY)
    return raw ? (JSON.parse(raw) as Record<string, ContractFreight>) : {}
  } catch {
    return {}
  }
}

export function usePiV2ViewPrefs() {
  // Começa nos defaults para servidor e primeiro render do cliente concordarem
  // (sem hydration mismatch); o valor guardado entra logo depois do mount.
  const [prefs, setPrefs] = useState<PiV2ViewPrefs>(DEFAULTS)

  useEffect(() => {
    setPrefs(readStored())
  }, [])

  const update = useCallback((patch: Partial<PiV2ViewPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignora falha de storage (modo privado, cota) — o estado vale na sessão
      }
      return next
    })
  }, [])

  const setGroupByCharacter = useCallback(
    (groupByCharacter: boolean) => update({ groupByCharacter }),
    [update]
  )
  const setShoppingPeriodHrs = useCallback(
    (shoppingPeriodHrs: number) => update({ shoppingPeriodHrs }),
    [update]
  )

  /**
   * Define a base central.
   *
   * A base sai da lista de hubs: ela não é um hub que se alcança, é o destino.
   * Manter as duas coisas ao mesmo tempo faria a estação concorrer consigo mesma
   * na escolha por custo efetivo.
   */
  const setBaseHub = useCallback(
    (baseHub: BaseHub | null) =>
      update({
        baseHub,
        hubs: baseHub
          ? withPublicHubs(prefs.hubs.filter((hub) => hub.id !== baseHub.id))
          : prefs.hubs,
      }),
    [update, prefs.hubs]
  )

  /**
   * Containers do armazém. Guardar o `characterId` junto do `itemId` não é
   * redundância: assets são por personagem, e é o dono que permite dizer QUAL
   * container não foi encontrado quando a config envelhece.
   */
  const setWarehouseContainers = useCallback(
    (warehouseContainers: WarehouseContainerConfig[]) => update({ warehouseContainers }),
    [update]
  )

  const setHubs = useCallback(
    (hubs: FreightHub[]) => update({ hubs: withPublicHubs(hubs) }),
    [update]
  )

  /** Guarda o contrato desta (rota, transportadora) para a próxima rodada. */
  const rememberContract = useCallback((hubId: string, contract: ContractFreight) => {
    if (!contract.transporter.trim()) return
    try {
      const memory = readContractMemory()
      memory[contractKey(hubId, contract.transporter)] = contract
      window.localStorage.setItem(CONTRACTS_KEY, JSON.stringify(memory))
    } catch {
      // ignora falha de storage — o contrato ainda vale nesta sessão
    }
  }, [])

  /** Devolve o último contrato usado nesta (rota, transportadora), se houver. */
  const recallContract = useCallback(
    (hubId: string, transporter: string): ContractFreight | undefined => {
      if (!transporter.trim()) return undefined
      return readContractMemory()[contractKey(hubId, transporter)]
    },
    []
  )

  /**
   * Semeia base + hubs a partir das estruturas que o perfil (v1) já tinha, uma
   * única vez. O localStorage mais antigo guardava só o FRETE das duas fixas; os
   * ids vêm do servidor. Sem isto, quem tinha só aquele formato perderia as duas
   * estações e o frete delas na primeira abertura da tela nova.
   */
  const seedFromLegacy = useCallback((legacy: Array<{ id: string; name: string }>) => {
    if (legacy.length === 0) return
    setPrefs((prev) => {
      // Nunca sobrescreve o que o jogador já montou. O critério é base ou hub de
      // ESTRUTURA: o frete de Jita/Região pode já ter migrado sozinho (ele vivia
      // no localStorage antigo), e isso não significa que as estruturas entraram.
      if (prev.baseHub || prev.hubs.some((hub) => !isPublicHubId(hub.id))) return prev
      let rates: number[] = []
      try {
        rates = readLegacyStructureRates(
          JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')
        )
      } catch {
        rates = []
      }
      const seeded = seedHubsFromLegacy(legacy, rates)
      const next: PiV2ViewPrefs = {
        ...prev,
        baseHub: seeded.baseHub,
        // Preserva os públicos que já vinham configurados (Região/Jita migrados).
        hubs: withPublicHubs([...seeded.hubs, ...prev.hubs.filter((hub) => hub.inbound)]),
      }
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // ignora falha de storage — o estado ainda vale na sessão
      }
      return next
    })
  }, [])

  return {
    groupByCharacter: prefs.groupByCharacter,
    shoppingPeriodHrs: prefs.shoppingPeriodHrs,
    baseHub: prefs.baseHub,
    hubs: prefs.hubs,
    warehouseContainers: prefs.warehouseContainers,
    setWarehouseContainers,
    setGroupByCharacter,
    setShoppingPeriodHrs,
    setBaseHub,
    setHubs,
    rememberContract,
    recallContract,
    seedFromLegacy,
  }
}
