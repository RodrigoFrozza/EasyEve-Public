/**
 * Alertas — a pergunta 1 respondida com o app FECHADO.
 *
 * O jogo não avisa nada: nem que o extrator parou, nem que o launchpad encheu,
 * nem que a fábrica travou. O jogador vira o sistema de alarme. Esta é a dor 2
 * da pesquisa, e é a única das três primeiras que dá para resolver de fora (a
 * ESI de PI é read-only — não existe POST; só dá para AVISAR).
 *
 * **Anti-spam em duas camadas**, porque alerta demais é igual a alerta nenhum —
 * foi assim que os "26 stalled" treinaram o usuário a ignorar a tela:
 *
 *  1. **Cooldown por problema** (`PiPlanetAlert`): o mesmo problema no mesmo pin
 *     não re-notifica dentro da janela. Um problema que some e volta re-notifica
 *     na hora — uma segunda crise nunca pode ser silenciada pelo cooldown da
 *     primeira.
 *  2. **Digest por varredura**: os problemas que passam do cooldown viram UMA
 *     notificação listando os planetas, não uma por commodity. É o padrão do
 *     planetsin — um ping por janela em vez de 25.
 *
 * Estado de alerta do v2 é PREFIXADO (`v2_`) para conviver com o do v1 na mesma
 * tabela sem colidir enquanto os dois módulos rodam em paralelo.
 */

import type { PortfolioColony } from '@/lib/pi-v2/portfolio'
import { eventKey, isProblem, type ColonyEvent, type ColonyEventKind } from '@/lib/pi-v2/events'

/** Prefixo que isola o estado de alerta do v2 do estado do v1 na mesma tabela. */
export const V2_ALERT_PREFIX = 'v2_'

export interface AlertCandidate {
  /** Já prefixado — é o valor que vai para `PiPlanetAlert.alertType`. */
  alertType: string
  kind: ColonyEventKind | 'stalled'
  /** 0 = alerta de colônia (ids reais de pin da ESI são sempre > 0). */
  pinId: number
  typeId?: number
  typeName?: string
  severity: 'amber' | 'red'
  /** Horas até o evento. <= 0 = já aconteceu. */
  inHours?: number
  planetId: number
  characterId: number
  planetName: string
  systemName: string
}

/**
 * Alertas que se aplicam a uma colônia agora. Deriva do que o portfólio já
 * calculou — nenhuma reprojeção, nenhuma chamada a ESI ou preço.
 *
 * Só eventos com severidade real viram alerta: `restock_due` e o que cai depois
 * da próxima visita são o ciclo normal, e notificar o ciclo normal é ruído.
 */
export function deriveAlertCandidates(colony: PortfolioColony): AlertCandidate[] {
  const place = {
    planetId: colony.planetId,
    characterId: colony.characterId,
    planetName: colony.planetName ?? colony.solarSystemName,
    systemName: colony.solarSystemName,
  }

  const candidates: AlertCandidate[] = []

  // Saída morta é alerta de colônia, não de pin: é o estado agregado, e o pin
  // que a causou já vai junto no evento de insumo.
  if (colony.projection.status.status === 'stalled') {
    candidates.push({
      ...place,
      alertType: `${V2_ALERT_PREFIX}stalled`,
      kind: 'stalled',
      pinId: 0,
      typeId: colony.projection.status.limitingTypeId,
      severity: 'red',
    })
  }

  // Um por (tipo de evento, pin) — nunca um por commodity.
  const seen = new Set<string>()
  for (const event of colony.events) {
    if (!isProblem(event)) continue
    const key = eventKey(event)
    if (seen.has(key)) continue
    seen.add(key)

    candidates.push({
      ...place,
      alertType: `${V2_ALERT_PREFIX}${event.kind}`,
      kind: event.kind,
      pinId: event.pinId ?? 0,
      typeId: event.typeId,
      typeName: event.typeName,
      severity: event.severity === 'red' ? 'red' : 'amber',
      inHours: event.inHours,
    })
  }

  return candidates
}

export interface AlertRecord {
  lastNotifiedAt: Date
  resolvedAt: Date | null
}

/**
 * Sem registro → notifica (é a primeira vez que vemos o problema).
 * Registro já resolvido → a condição havia sumido e voltou: notifica na hora,
 * mesmo dentro do cooldown.
 * Registro aberto → só re-notifica depois de `cooldownHrs` desde o último aviso,
 * para não repetir a cada rodada do scheduler.
 */
export function shouldNotify(
  existing: AlertRecord | undefined,
  now: Date,
  cooldownHrs: number
): boolean {
  if (!existing) return true
  if (existing.resolvedAt !== null) return true
  return (now.getTime() - existing.lastNotifiedAt.getTime()) / 3_600_000 >= cooldownHrs
}

/**
 * Janela de silêncio do mesmo problema. Amarrada à cadência de visita: não faz
 * sentido avisar duas vezes entre duas visitas ao planeta, já que o jogador só
 * pode agir quando volta lá. Piso de 6h para cadências muito curtas.
 */
export function resolveCooldownHrs(cadenceHrs: number): number {
  return Math.max(6, cadenceHrs)
}

export interface AlertDigest {
  title: string
  content: string
}

/**
 * Texto da notificação. pt-BR como string final, não pela chave de i18n: o
 * conteúdo é PERSISTIDO no banco no instante da criação e lido depois pelo sino,
 * então não passa pelo sistema de i18n do cliente. É o mesmo padrão que
 * `auto-activity-detection.ts` já usa para notificação automática.
 */
const KIND_LABEL: Record<AlertCandidate['kind'], string> = {
  stalled: 'parada',
  supply_out: 'sem insumo',
  degraded: 'produção local em déficit',
  space_out: 'sem espaço',
  extractor_expiry: 'extrator expirando',
  restock_due: 'reposição prevista',
  data_suspended: 'dado desatualizado',
}

function whenLabel(inHours: number | undefined): string {
  if (inHours == null) return ''
  if (inHours <= 0) return ' agora'
  if (inHours < 1) return ` em ~${Math.max(1, Math.round(inHours * 60))}min`
  return ` em ~${Math.round(inHours)}h`
}

function describe(candidate: AlertCandidate): string {
  const where = `${candidate.planetName} (${candidate.systemName})`
  const item = candidate.typeName ? ` — ${candidate.typeName}` : ''
  switch (candidate.kind) {
    case 'stalled':
      return `${where}: parou de exportar${item}.`
    case 'supply_out':
      return `${where}: fica sem insumo comprado${whenLabel(candidate.inHours)}${item}.`
    case 'degraded':
      // Nunca dizer "reponha": isto é fabricado no planeta, não se compra.
      return `${where}: a produção local${item} não cobre o consumo — a cadeia a montante é o gargalo.`
    case 'space_out':
      return `${where}: fica sem espaço${whenLabel(candidate.inHours)} — a produção passa a ser perdida.`
    case 'extractor_expiry':
      return `${where}: extrator${item} expira${whenLabel(candidate.inHours)} — reabra a colônia no jogo e refaça o survey.`
    case 'data_suspended':
      return `${where}: sem leitura há mais de 72h — não dá para projetar. Abra a colônia no jogo.`
    case 'restock_due':
      return `${where}: reposição prevista${whenLabel(candidate.inHours)}.`
  }
}

/**
 * Uma notificação para a varredura inteira do usuário. O título conta quantos
 * planetas precisam de ação; o corpo lista o que fazer em cada um, do mais grave
 * ao menos. Vinte e cinco planetas com problema geram UM ping, não vinte e cinco.
 */
export function buildDigest(candidates: AlertCandidate[]): AlertDigest | null {
  if (candidates.length === 0) return null

  const planets = new Set(candidates.map((c) => c.planetId))
  const red = candidates.filter((c) => c.severity === 'red').length

  const ordered = [...candidates].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'red' ? -1 : 1
    return (a.inHours ?? Number.POSITIVE_INFINITY) - (b.inHours ?? Number.POSITIVE_INFINITY)
  })

  const title =
    planets.size === 1
      ? `PI: ${ordered[0]!.planetName} precisa de atenção (${KIND_LABEL[ordered[0]!.kind]})`
      : `PI: ${planets.size} colônias precisam de atenção${red > 0 ? ` (${red} urgente${red > 1 ? 's' : ''})` : ''}`

  return { title, content: ordered.map(describe).join('\n') }
}
