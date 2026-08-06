'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, Home, Loader2, Plus, Trash2, Truck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatUnitPrice } from '@/lib/pi-v2/format'
import { MAX_STRUCTURE_HUBS } from '@/lib/pi-v2/freight-prefs'
import { marginalRatePerM3, type ContractFreight } from '@/lib/pi-v2/pricing/freight'
import {
  isPublicHubId,
  REGION_HUB_ID,
  type BaseHub,
  type FreightHub,
} from '@/lib/pi-v2/pricing/freight-model'
import type { StationCandidate } from '@/lib/pi-v2/station-search'
import type { JfPlanInfo } from '@/lib/pi-v2/shopping-types'
import { HelpTip } from './HelpTip'
import { HubFreightForm } from './HubFreightForm'

/**
 * Base central + hubs — o frete inteiro numa tela.
 *
 * O modelo é uniforme de propósito: o jogador tem **uma base** onde junta o PI, e
 * compra em vários hubs, cada um alcançado por um método que ele escolhe. Uma
 * estrutura em C-J6 e o mercado de Jita são a mesma coisa aqui — uma origem com um
 * custo de trazer.
 *
 * A tela nasceu longa demais: com quatro hubs abertos, a config não caberia na
 * janela e o jogador rolava procurando o que já tinha preenchido. Agora **cada hub
 * é um card colapsável** que, fechado, resume em uma linha o que importa —
 * `C-J6MT · JF próprio · 233 ISK/m³`. Configurado nasce fechado; sem configurar
 * nasce aberto, porque aí há trabalho a fazer.
 *
 * A busca vai na ESI e **só devolve estrutura onde ele pode atracar**, então não há
 * como cadastrar um hub inacessível e receber preço de mentira.
 */

/** Busca de estrutura na ESI. Serve para escolher a base e para somar hubs. */
function StationSearch({
  disabled,
  taken,
  onPick,
  actionLabel,
}: {
  disabled?: boolean
  taken: Set<string>
  onPick: (station: { id: string; name: string }) => void
  actionLabel: string
}) {
  const { t } = useTranslations()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<StationCandidate[]>([])
  const [searching, setSearching] = useState(false)
  const [searched, setSearched] = useState(false)

  const search = async () => {
    const q = query.trim()
    if (q.length < 3) return
    setSearching(true)
    setSearched(false)
    try {
      // `withMarket=1`: estrutura sem módulo de mercado é inútil aqui — cadastrar
      // uma dessas só rende um aviso depois. O filtro é opt-in porque o modal do
      // v1 usa o mesmo endpoint e não pode mudar de comportamento.
      const res = await fetch(`/api/pi/structures?withMarket=1&q=${encodeURIComponent(q)}`)
      const data = res.ok ? await res.json() : { structures: [] }
      setResults(Array.isArray(data.structures) ? data.structures : [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
      setSearched(true)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void search()
          }}
          placeholder={t('piV2.shopping.searchStation')}
          disabled={disabled}
          className="h-8 max-w-xs border-zinc-800 bg-zinc-950 text-xs"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => void search()}
          disabled={searching || disabled || query.trim().length < 3}
          className="h-8 gap-1.5"
        >
          {searching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          {actionLabel}
        </Button>
      </div>

      {results.length > 0 ? (
        <ul className="mt-1.5 space-y-0.5">
          {results.map((r) => (
            <li key={r.structureId}>
              <button
                type="button"
                onClick={() => {
                  onPick({ id: r.structureId, name: r.name })
                  setQuery('')
                  setResults([])
                  setSearched(false)
                }}
                disabled={taken.has(r.structureId)}
                className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] text-zinc-300 hover:bg-zinc-800/60 disabled:text-zinc-600"
              >
                <span className="min-w-0 truncate">{r.name}</span>
                {r.market === 'unknown' ? (
                  // A ESI não confirmou o mercado. Mostrar com ressalva é mais
                  // honesto que sumir — some quem NÃO tem, não quem não deu para
                  // checar.
                  <span
                    className="shrink-0 text-[10px] text-amber-300"
                    title={t('piV2.shopping.marketUnconfirmedTooltip')}
                  >
                    {t('piV2.shopping.marketUnconfirmed')}
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : searched && !searching ? (
        <p className="mt-1.5 text-[11px] text-zinc-500">
          {t('piV2.shopping.noStationsWithMarket', { query: query.trim() })}
        </p>
      ) : null}
    </div>
  )
}

/**
 * A taxa por item do hub, para o resumo do card fechado.
 *
 * Courier a gente calcula aqui (a fórmula é pura e client-safe); JF vem do
 * servidor, porque depende de andar o book do isótopo. Enquanto o servidor não
 * responde, `null` — e o resumo mostra só o método, nunca um número chutado.
 */
function inboundRate(hub: FreightHub, plans: JfPlanInfo[]): number | null {
  const leg = hub.inbound
  if (!leg || leg.method === 'local') return null
  if (leg.method === 'courier') return marginalRatePerM3(leg)
  return plans.find((p) => p.direction === 'inbound')?.ratePerM3 ?? null
}

/** Um hub: cabeçalho com resumo + formulário das pernas, colapsável. */
function HubCard({
  hub,
  label,
  isPublic,
  warned,
  plans,
  onChange,
  onRemove,
  onRememberContract,
  onRecallContract,
}: {
  hub: FreightHub
  label: string
  isPublic: boolean
  warned: boolean
  plans: JfPlanInfo[]
  onChange: (next: FreightHub) => void
  onRemove?: () => void
  onRememberContract: (hubId: string, contract: ContractFreight) => void
  onRecallContract: (hubId: string, transporter: string) => ContractFreight | undefined
}) {
  const { t } = useTranslations()
  const configured = hub.inbound != null
  // Configurado nasce fechado (nada a fazer); sem configurar nasce aberto, porque
  // há trabalho pendente. Região é exceção: a maioria não compra lá, então fica
  // fechada mesmo vazia para não roubar a atenção.
  const [open, setOpen] = useState(!configured && hub.id !== REGION_HUB_ID)

  const rate = inboundRate(hub, plans)
  const methodLabel = hub.inbound
    ? t(`piV2.shopping.freightMode.${hub.inbound.method === 'jf' ? 'jf' : 'courier'}`)
    : null

  return (
    <div
      className={cn(
        'rounded-lg border bg-zinc-950/40',
        warned ? 'border-amber-500/30' : 'border-zinc-800/80'
      )}
    >
      <div className="flex items-center gap-2 px-2.5 py-2">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-500" />
          )}
          <span
            className={cn(
              'min-w-0 truncate text-xs',
              warned
                ? 'text-amber-300'
                : isPublic
                  ? hub.id === 'jita'
                    ? 'text-emerald-300'
                    : 'text-sky-300'
                  : 'text-zinc-200'
            )}
          >
            {label}
          </span>

          {/* O resumo de uma linha: o que o jogador precisa saber sem abrir. */}
          {configured ? (
            <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-zinc-500">
              <span className="text-zinc-600">·</span>
              <span className="truncate">{methodLabel}</span>
              {rate != null ? (
                <>
                  <span className="text-zinc-600">·</span>
                  <span className="shrink-0 tabular-nums text-zinc-300">
                    {formatUnitPrice(rate)} ISK/m³
                  </span>
                </>
              ) : null}
            </span>
          ) : (
            <span className="shrink-0 text-[11px] text-amber-300">
              · {t('piV2.shopping.hubs.notConfigured')}
            </span>
          )}

          {hub.outbound ? (
            <span className="shrink-0 rounded bg-zinc-700/40 px-1 py-px text-[10px] text-zinc-300">
              {t('piV2.shopping.hubs.sellsHere')}
            </span>
          ) : null}
          {warned ? (
            <span className="shrink-0 text-[10px] text-amber-300">
              · {t('piV2.shopping.stationNoMarketShort')}
            </span>
          ) : null}
        </button>

        {isPublic ? (
          <>
            <span className="shrink-0 rounded bg-zinc-800/60 px-1.5 py-px text-[10px] text-zinc-400">
              {t('piV2.shopping.hubs.optional')}
            </span>
            <HelpTip title={t(`piV2.shopping.${hub.id}Help.title`)}>
              <p>{t(`piV2.shopping.${hub.id}Help.body`)}</p>
              <p className="text-zinc-500">{t('piV2.shopping.hubs.optionalHelp')}</p>
            </HelpTip>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            aria-label={t('piV2.shopping.removeStation', { name: hub.name })}
            onClick={onRemove}
            className="h-7 w-7 shrink-0 p-0 text-zinc-500 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {open ? (
        <div className="border-t border-zinc-800/60 p-2.5 pt-2">
          {warned ? (
            <p className="mb-2 text-[11px] text-amber-300">{t('piV2.shopping.stationNoMarket')}</p>
          ) : null}
          <HubFreightForm
            hub={hub}
            plans={plans}
            onChange={onChange}
            onRememberContract={onRememberContract}
            onRecallContract={onRecallContract}
          />
        </div>
      ) : null}
    </div>
  )
}

export function FreightHubsPanel({
  baseHub,
  hubs,
  warnings,
  jfPlans,
  onBaseChange,
  onHubsChange,
  onRememberContract,
  onRecallContract,
}: {
  baseHub: BaseHub | null
  hubs: FreightHub[]
  warnings: Array<{ id: string; name: string; reason: string }>
  jfPlans: JfPlanInfo[]
  onBaseChange: (base: BaseHub | null) => void
  onHubsChange: (next: FreightHub[]) => void
  onRememberContract: (hubId: string, contract: ContractFreight) => void
  onRecallContract: (hubId: string, transporter: string) => ContractFreight | undefined
}) {
  const { t } = useTranslations()
  const [editingBase, setEditingBase] = useState(false)

  const structureHubs = hubs.filter((hub) => !isPublicHubId(hub.id))
  const atLimit = structureHubs.length >= MAX_STRUCTURE_HUBS
  const warnedIds = new Set(warnings.map((w) => w.id))
  const takenIds = new Set([...hubs.map((h) => h.id), ...(baseHub ? [baseHub.id] : [])])
  const plansFor = (hubId: string) => jfPlans.filter((p) => p.hubKey === hubId)

  const patchHub = (next: FreightHub) =>
    onHubsChange(hubs.map((hub) => (hub.id === next.id ? next : hub)))

  const hubLabel = (hub: FreightHub) =>
    isPublicHubId(hub.id) ? t(`piV2.shopping.hub.${hub.id}`) : hub.name

  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      {/* A base central. Sem ela não há "até onde" — todo frete é até aqui. */}
      <div>
        <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
          <Home className="h-3 w-3" />
          {t('piV2.shopping.hubs.baseTitle')}
          <HelpTip title={t('piV2.shopping.hubs.baseHelp.title')}>
            <p>{t('piV2.shopping.hubs.baseHelp.body')}</p>
          </HelpTip>
        </p>
        {baseHub && !editingBase ? (
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-xs text-zinc-200" title={baseHub.name}>
              {baseHub.name}
              <span className="ml-1.5 text-[10px] text-emerald-400/80">
                {t('piV2.shopping.hubs.baseLocal')}
              </span>
              {warnedIds.has(baseHub.id) ? (
                <span className="ml-1.5 text-[10px] text-amber-300">
                  {t('piV2.shopping.stationNoMarketShort')}
                </span>
              ) : null}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingBase(true)}
              className="h-8 shrink-0 px-2 text-[11px] text-zinc-400 hover:text-violet-200"
            >
              {t('piV2.shopping.hubs.changeBase')}
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {!baseHub ? (
              <p className="text-[11px] text-amber-300">{t('piV2.shopping.hubs.baseMissing')}</p>
            ) : null}
            <StationSearch
              taken={new Set(hubs.map((h) => h.id))}
              actionLabel={t('piV2.shopping.addStation')}
              onPick={(station) => {
                onBaseChange(station)
                setEditingBase(false)
              }}
            />
            {baseHub ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingBase(false)}
                className="h-7 px-2 text-[11px] text-zinc-500"
              >
                {t('piV2.shopping.hubs.cancel')}
              </Button>
            ) : null}
          </div>
        )}
      </div>

      {/* Os hubs, cada um num card que abre e fecha. */}
      <div className="border-t border-zinc-800/60 pt-2.5">
        <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
          <Truck className="h-3 w-3" />
          {t('piV2.shopping.hubs.title')}
          <HelpTip title={t('piV2.shopping.freightHelp.title')}>
            <div>
              <p className="font-medium text-zinc-200">
                {t('piV2.shopping.freightHelp.fleetTitle')}
              </p>
              <p>{t('piV2.shopping.freightHelp.fleetBody')}</p>
            </div>
            <div>
              <p className="font-medium text-zinc-200">
                {t('piV2.shopping.freightHelp.courierTitle')}
              </p>
              <p>{t('piV2.shopping.freightHelp.courierBody')}</p>
            </div>
          </HelpTip>
        </p>

        <div className="space-y-1.5">
          {hubs.map((hub) => (
            <HubCard
              key={hub.id}
              hub={hub}
              label={hubLabel(hub)}
              isPublic={isPublicHubId(hub.id)}
              warned={warnedIds.has(hub.id)}
              plans={plansFor(hub.id)}
              onChange={patchHub}
              onRemove={() => onHubsChange(hubs.filter((h) => h.id !== hub.id))}
              onRememberContract={onRememberContract}
              onRecallContract={onRecallContract}
            />
          ))}
        </div>

        <div className="mt-2.5 border-t border-zinc-800/60 pt-2">
          <StationSearch
            disabled={atLimit}
            taken={takenIds}
            actionLabel={t('piV2.shopping.addStation')}
            onPick={(station) => {
              if (atLimit || takenIds.has(station.id)) return
              onHubsChange([...hubs, { id: station.id, name: station.name }])
            }}
          />
          {atLimit ? (
            <p className="mt-1.5 text-[11px] text-zinc-500">
              {t('piV2.shopping.stationLimit', { max: MAX_STRUCTURE_HUBS })}
            </p>
          ) : null}
        </div>
      </div>

      <p className="text-[10px] text-zinc-500">{t('piV2.shopping.stationsNote')}</p>
    </div>
  )
}
