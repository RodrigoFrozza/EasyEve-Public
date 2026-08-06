/**
 * Portfólio — todos os personagens numa tela, ordenados por urgência de ação.
 *
 * É a resposta à pergunta 1. Junta, por colônia: a projeção (onde ela está
 * agora), os eventos (o que quebra e quando), a urgência (o que fazer) e o grid.
 * Não toca em preço: a economia é a pergunta 2, e ela consome esta saída, não o
 * contrário.
 *
 * **Falha nunca é invisível.** Personagem sem scope, personagem cuja lista de
 * planetas falhou e planeta cujo layout falhou saem em listas próprias, e a UI é
 * obrigada a dizer que os números abaixo estão incompletos. Um erro de ESI nunca
 * vira colônia ausente em silêncio.
 */

import { computeColonyGrid, type GridUsage } from '@/lib/pi-v2/grid'
import { deriveColonyEvents, type ColonyEvent } from '@/lib/pi-v2/events'
import { projectColonyState, type ColonyProjection } from '@/lib/pi-v2/project-colony'
import {
  classifyColony,
  compareUrgency,
  countBuckets,
  type ColonyUrgency,
  type PortfolioCounters,
} from '@/lib/pi-v2/urgency'
import { PLANET_TYPES } from '@/lib/pi-v2/sde'
import type { PiColonyLayout, PiColonySummary } from '@/lib/pi-v2/esi'
import {
  getCharacterPlanets,
  getColonyLayout,
  loadPiUserConfig,
  logger,
  parseScopesFromJwt,
  PI_SCOPE,
  resolvePlanetNames,
  resolveSolarSystemNames,
  safeDecryptToken,
} from '@/lib/pi-v2/host'

export interface PortfolioColony {
  characterId: number
  characterName: string
  planetId: number
  /** Nome celestial da ESI (ex.: "6-IAFR I"). Ausente se a resolução falhar. */
  planetName?: string
  solarSystemId: number
  solarSystemName: string
  planetType: string
  planetTypeLabel: string
  projection: ColonyProjection
  events: ColonyEvent[]
  urgency: ColonyUrgency
  grid: GridUsage
}

export interface Portfolio {
  /** Já ordenadas por urgência de ação — a ordem da tela sai daqui, não da UI. */
  colonies: PortfolioColony[]
  counters: PortfolioCounters
  fetchedAt: string
  /** Cadência de visita em vigor (global, por enquanto). */
  cadenceHrs: number
  charactersWithoutScope: number[]
  charactersFailed: number[]
  planetsFailed: Array<{ characterId: number; planetId: number }>
}

export interface BuildPortfolioInput {
  userId: string
  characters: Array<{ id: number; name: string; accessToken?: string | null }>
  characterIdFilter?: number
  forceRefresh?: boolean
  /** Instante da projeção. Injetável para teste; default agora. */
  nowMs?: number
}

interface RawColony {
  characterId: number
  characterName: string
  summary: PiColonySummary
  layout: PiColonyLayout
}

export async function buildPortfolio(input: BuildPortfolioInput): Promise<Portfolio> {
  const nowMs = input.nowMs ?? Date.now()
  const characters = input.characterIdFilter
    ? input.characters.filter((c) => c.id === input.characterIdFilter)
    : input.characters

  const { preferences } = await loadPiUserConfig(input.userId)
  const cadenceHrs = preferences.visitCadenceHrs ?? undefined

  const charactersWithoutScope: number[] = []
  const charactersFailed: number[] = []
  const planetsFailed: Array<{ characterId: number; planetId: number }> = []
  const raw: RawColony[] = []

  await Promise.all(
    characters.map(async (character) => {
      const scopes = parseScopesFromJwt(safeDecryptToken(character.accessToken) ?? '')
      if (!scopes.includes(PI_SCOPE)) {
        charactersWithoutScope.push(character.id)
        return
      }

      let summaries: PiColonySummary[]
      try {
        summaries = (await getCharacterPlanets(character.id, input.userId, {
          forceRefresh: input.forceRefresh,
        })) as PiColonySummary[]
      } catch (error) {
        logger.warn('PiV2', `Personagem ${character.id} ignorado — lista de planetas falhou`, error)
        charactersFailed.push(character.id)
        return
      }

      const layouts = await Promise.all(
        summaries.map(async (summary) => {
          try {
            const layout = (await getColonyLayout(
              character.id,
              summary.planet_id,
              input.userId,
              { forceRefresh: input.forceRefresh },
              summary.last_update
            )) as PiColonyLayout | null
            if (!layout) return null
            return {
              characterId: character.id,
              characterName: character.name,
              summary,
              layout,
            }
          } catch (error) {
            logger.warn(
              'PiV2',
              `Planeta ${summary.planet_id} do personagem ${character.id} ignorado`,
              error
            )
            planetsFailed.push({ characterId: character.id, planetId: summary.planet_id })
            return null
          }
        })
      )

      for (const entry of layouts) {
        if (entry) raw.push(entry)
      }
    })
  )

  // Nomes resolvidos em um lote só para todas as colônias. Ambos os resolvedores
  // cacheiam indefinidamente (dado estático do SDE): custo de ESI só na primeira
  // vez que um id aparece, depois é de graça.
  const [systemNames, planetNames] = await Promise.all([
    resolveSolarSystemNames([...new Set(raw.map((r) => r.summary.solar_system_id))]),
    resolvePlanetNames([...new Set(raw.map((r) => r.summary.planet_id))]),
  ])

  const colonies: PortfolioColony[] = raw.map((entry) => {
    const projection = projectColonyState({
      summary: entry.summary,
      layout: entry.layout,
      contract: { visitCadenceHrs: cadenceHrs },
      nowMs,
    })
    const events = deriveColonyEvents(projection, nowMs)

    return {
      characterId: entry.characterId,
      characterName: entry.characterName,
      planetId: entry.summary.planet_id,
      planetName: planetNames[entry.summary.planet_id],
      solarSystemId: entry.summary.solar_system_id,
      solarSystemName:
        systemNames[entry.summary.solar_system_id] ?? `System ${entry.summary.solar_system_id}`,
      planetType: entry.summary.planet_type,
      planetTypeLabel: PLANET_TYPES[entry.summary.planet_type] ?? entry.summary.planet_type,
      projection,
      events,
      urgency: classifyColony(projection, events),
      grid: computeColonyGrid(entry.layout, entry.summary.upgrade_level ?? 0),
    }
  })

  colonies.sort(compareUrgency)

  return {
    colonies,
    counters: countBuckets(colonies.map((c) => c.urgency.bucket)),
    fetchedAt: new Date(nowMs).toISOString(),
    cadenceHrs: colonies[0]?.projection.cadenceHrs ?? cadenceHrs ?? 24,
    charactersWithoutScope,
    charactersFailed,
    planetsFailed,
  }
}
