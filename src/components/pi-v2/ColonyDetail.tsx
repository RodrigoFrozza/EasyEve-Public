'use client'

import { Clock, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { formatBufferCountdown, formatPiRate } from '@/lib/pi/format'
import { formatM3, formatUnits } from '@/lib/pi-v2/format'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PiCollapsiblePanel } from '@/components/pi/PiCollapsiblePanel'
import { PiPlanetIcon } from '@/components/pi/PiPlanetIcon'
import type { PortfolioColony } from '@/lib/pi-v2/portfolio'
import type { StoreBufferStatus } from '@/lib/pi-v2/buffers'
import type { ColonyEvent } from '@/lib/pi-v2/events'
import type { ColonyPnlEntry } from '@/lib/pi-v2/shopping-types'
import type { SellHubChoice } from '@/lib/pi-v2/pricing/freight-model'
import { ColonyPnlPanel } from './ColonyPnlPanel'
import { FieldHelp, HelpTip } from './HelpTip'
import { ProjectedValue, StalenessSeal } from './StalenessSeal'
import { useActionLabel } from './ColonyCard'
import { GridPanel } from './GridPanel'
import { PiV2ItemIcon } from './PiV2ItemIcon'
import { TierBadge } from './TierBadge'

/**
 * Detalhe da colônia — **status e ação primeiro**.
 *
 * A ordem da tela é a ordem das perguntas: o que está errado, o que fazer, e só
 * então os números que sustentam a conclusão. Receita e balanço são Nível 3 e
 * nascem colapsados: quem abre o detalhe quer agir, não auditar.
 */

const SEVERITY_TONE = {
  red: 'border-red-500/40 bg-red-500/10 text-red-200',
  amber: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
  info: 'border-zinc-700 bg-zinc-800/40 text-zinc-300',
} as const

function EventRow({ event }: { event: ColonyEvent }) {
  const { t } = useTranslations()
  const when =
    event.inHours <= 0
      ? t('piV2.action.overdue')
      : t('piV2.action.inTime', { time: formatBufferCountdown(event.inHours) ?? '0m' })

  return (
    <li className={cn('flex items-center gap-2 rounded border px-2 py-1.5 text-xs', SEVERITY_TONE[event.severity])}>
      {event.typeId ? <PiV2ItemIcon typeId={event.typeId} name={event.typeName} size={16} /> : null}
      <span className="min-w-0 flex-1 truncate">
        {t(`piV2.event.${event.kind}`)}
        {event.typeName ? <span className="text-zinc-400"> · {event.typeName}</span> : null}
        {event.pinLabel ? <span className="text-zinc-500"> · {event.pinLabel}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-1 tabular-nums">
        <Clock className="h-3 w-3" aria-hidden />
        {when}
      </span>
    </li>
  )
}

/** Cabeçalho de coluna com o `?` da explicação — a dúvida 10, respondida na tabela. */
function ColumnHeader({ label, help }: { label: string; help: string }) {
  return (
    <th className="py-1 text-right font-medium">
      <span className="inline-flex items-center gap-1">
        {label}
        <FieldHelp title={label} body={help} />
      </span>
    </th>
  )
}

function StoreCard({ store, projectionApplied }: { store: StoreBufferStatus; projectionApplied: boolean }) {
  const { t } = useTranslations()
  const fillPct = store.capacityM3 > 0 ? Math.min(100, (store.usedM3 / store.capacityM3) * 100) : 0

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2.5">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-xs font-medium text-zinc-300">{store.label}</span>
        <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">
          {formatM3(store.usedM3)} / {formatM3(store.capacityM3)} m³
          <span className="ml-1">({Math.round(fillPct)}%)</span>
        </span>
      </div>
      <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-zinc-800">
        <div
          className={cn('h-full rounded-full', fillPct >= 95 ? 'bg-red-500' : fillPct >= 85 ? 'bg-amber-400' : 'bg-sky-500')}
          style={{ width: `${fillPct}%` }}
        />
      </div>

      {store.flows.length === 0 ? (
        <p className="text-[11px] text-zinc-600">{t('piV2.detail.noFlows')}</p>
      ) : (
        <table className="w-full text-[11px]">
          <tbody>
            {store.flows.map((flow) => (
              <tr key={flow.typeId} className="border-t border-zinc-900">
                <td className="py-0.5 pr-2 text-zinc-400">
                  <span className="flex items-center gap-1.5">
                    <PiV2ItemIcon typeId={flow.typeId} name={flow.name} size={16} />
                    <span className="min-w-0 truncate">{flow.name}</span>
                  </span>
                </td>
                <td className="py-0.5 pr-2 text-right">
                  <ProjectedValue
                    value={formatUnits(flow.amount)}
                    projected={flow.projected && projectionApplied}
                    measured={formatUnits(flow.amountMeasured)}
                  />
                </td>
                <td
                  className={cn(
                    'py-0.5 pr-2 text-right tabular-nums',
                    flow.netPerHour > 0 ? 'text-emerald-400/80' : flow.netPerHour < 0 ? 'text-orange-400/80' : 'text-zinc-600'
                  )}
                >
                  {flow.netPerHour > 0 ? '+' : ''}
                  {formatPiRate(flow.netPerHour)}/h
                </td>
                <td className="py-0.5 text-right tabular-nums text-zinc-500">
                  {flow.timeToEmptyHrs != null ? formatBufferCountdown(flow.timeToEmptyHrs) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {store.restockDueHrs != null ? (
        <p className="mt-1.5 text-[11px] text-sky-300/90">
          {t('piV2.detail.restockDue', {
            time: formatBufferCountdown(store.restockDueHrs) ?? '0m',
          })}
        </p>
      ) : null}
    </div>
  )
}

export function ColonyDetail({
  colony,
  pnl,
  sellHub,
  economyLoading,
  open,
  onOpenChange,
}: {
  colony: PortfolioColony | null
  /** P&L desta colônia. Ausente enquanto o mercado não respondeu. */
  pnl?: ColonyPnlEntry
  sellHub?: SellHubChoice
  economyLoading?: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslations()
  const actionLabel = useActionLabel()

  if (!colony) return null

  const { projection, urgency, events } = colony
  const { text, due } = actionLabel(urgency.action)
  const problems = events.filter((e) => e.severity !== 'info')
  const upcoming = events.filter((e) => e.severity === 'info')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto border-zinc-800 bg-zinc-950">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-base">
            <PiPlanetIcon
              planetType={colony.planetType}
              label={colony.planetTypeLabel}
              size={28}
            />
            <span className="min-w-0 truncate">
              {colony.planetName ?? colony.solarSystemName}
            </span>
            <StalenessSeal confidence={projection.confidence} />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* 1 — o que está errado e o que fazer. Sempre primeiro. */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-violet-300">
              {t('piV2.detail.actionTitle')}
            </p>
            <p className="mt-1 text-sm font-medium text-zinc-100">
              {text}
              {due ? <span className="ml-2 text-xs font-normal text-zinc-400">· {due}</span> : null}
            </p>
            <p className="mt-1 text-[11px] text-zinc-500">
              {t(`piV2.status.${projection.status.status}`)} ·{' '}
              {t('piV2.detail.cadence', { hours: Math.round(projection.cadenceHrs) })} ·{' '}
              {colony.characterName} · {colony.solarSystemName}
            </p>

            {problems.length > 0 ? (
              <ul className="mt-2.5 space-y-1">
                {problems.map((event, i) => (
                  <EventRow key={`${event.kind}-${event.pinId ?? 0}-${i}`} event={event} />
                ))}
              </ul>
            ) : null}
            {upcoming.length > 0 ? (
              <ul className="mt-1.5 space-y-1">
                {upcoming.map((event, i) => (
                  <EventRow key={`u-${event.kind}-${event.pinId ?? 0}-${i}`} event={event} />
                ))}
              </ul>
            ) : null}
          </div>

          {/* 2 — os buffers, com estoque projetado e o medido a um tooltip. */}
          <div>
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
              {t('piV2.detail.storesTitle')}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {projection.stores.map((store) => (
                <StoreCard
                  key={store.pinId}
                  store={store}
                  projectionApplied={projection.confidence.projectionApplied}
                />
              ))}
            </div>
            {!projection.confidence.projectionApplied && projection.confidence.ageHours > 0 ? (
              <p className="mt-1.5 text-[11px] text-red-300/90">
                {t('piV2.detail.projectionSuspended')}
              </p>
            ) : null}
          </div>

          {/* 3 — grid do Command Center. */}
          <GridPanel grid={colony.grid} />

          {/* 4 — o P&L. Aberto por default: é a resposta da pergunta 2, e o
              jogador abre o detalhe para decidir se vale a pena manter a colônia. */}
          <PiCollapsiblePanel title={t('piV2.pnl.title')} tone="emerald" defaultOpen>
            {pnl ? (
              <ColonyPnlPanel
                pnl={pnl.current}
                designed={pnl.designed}
                sellHubName={sellHub?.hubName}
                sellsAtBase={sellHub?.hubKey == null}
              />
            ) : (
              <p className="flex items-center gap-2 text-[11px] text-zinc-500">
                {economyLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-300" />
                ) : null}
                {t(economyLoading ? 'piV2.pnl.loading' : 'piV2.pnl.unavailable')}
              </p>
            )}
          </PiCollapsiblePanel>

          {/* Nível 3 — colapsados. Quem abriu o detalhe quer agir, não auditar. */}
          <PiCollapsiblePanel
            title={t('piV2.detail.balancesTitle')}
            tone="emerald"
            count={projection.balances.designed.length}
          >
            {/* A legenda: sem ela, "Makes/Uses/Imports/Exports" é jargão. */}
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500">
                {t('piV2.detail.balancesLegendTitle')}
              </span>
              <HelpTip title={t('piV2.detail.balancesTitle')}>
                <p>{t('piV2.detail.balancesHelp')}</p>
              </HelpTip>
            </div>
            <table className="w-full text-[11px]">
              <thead className="text-zinc-500">
                <tr>
                  <th className="py-1 text-left font-medium">{t('piV2.detail.commodity')}</th>
                  <ColumnHeader
                    label={t('piV2.detail.produced')}
                    help={t('piV2.detail.columnHelp.produced')}
                  />
                  <ColumnHeader
                    label={t('piV2.detail.consumed')}
                    help={t('piV2.detail.columnHelp.consumed')}
                  />
                  <ColumnHeader
                    label={t('piV2.detail.imported')}
                    help={t('piV2.detail.columnHelp.imported')}
                  />
                  <ColumnHeader
                    label={t('piV2.detail.exported')}
                    help={t('piV2.detail.columnHelp.exported')}
                  />
                </tr>
              </thead>
              <tbody>
                {projection.balances.designed.map((balance) => (
                  <tr key={balance.typeId} className="border-t border-zinc-800/60">
                    <td className="py-0.5 text-zinc-300">
                      <span className="flex items-center gap-1.5">
                        <PiV2ItemIcon typeId={balance.typeId} name={balance.name} size={16} />
                        <span className="min-w-0 truncate">{balance.name}</span>
                        <TierBadge tier={balance.tier} />
                      </span>
                    </td>
                    <td className="py-0.5 text-right tabular-nums text-zinc-400">
                      {formatPiRate(balance.extractionPerHour + balance.productionPerHour)}
                    </td>
                    <td className="py-0.5 text-right tabular-nums text-zinc-400">
                      {formatPiRate(balance.demandPerHour)}
                    </td>
                    <td className="py-0.5 text-right tabular-nums text-orange-300/80">
                      {formatPiRate(balance.importNeededPerHour)}
                    </td>
                    <td className="py-0.5 text-right tabular-nums text-emerald-300/80">
                      {formatPiRate(balance.exportedPerHour)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[10px] text-zinc-500">{t('piV2.detail.balancesNote')}</p>
          </PiCollapsiblePanel>

          {projection.extractors.length > 0 ? (
            <PiCollapsiblePanel
              title={t('piV2.detail.extractorsTitle')}
              tone="amber"
              count={projection.extractors.length}
            >
              <table className="w-full text-[11px]">
                <tbody>
                  {projection.extractors.map((extractor) => (
                    <tr key={extractor.pinId} className="border-t border-zinc-800/60">
                      <td className="py-0.5 text-zinc-300">
                        <span className="flex items-center gap-1.5">
                          <PiV2ItemIcon
                            typeId={extractor.productTypeId}
                            name={extractor.productName}
                            size={16}
                          />
                          <span className="min-w-0 truncate">{extractor.productName}</span>
                        </span>
                      </td>
                      <td className="py-0.5 text-right tabular-nums text-zinc-400">
                        {formatPiRate(extractor.currentUnitsPerHour)} /{' '}
                        <span className="text-zinc-600">
                          {formatPiRate(extractor.designedUnitsPerHour)}
                        </span>
                      </td>
                      <td
                        className={cn(
                          'py-0.5 text-right tabular-nums',
                          extractor.isExpired ? 'text-red-300' : 'text-zinc-500'
                        )}
                      >
                        {extractor.isExpired
                          ? t('piV2.detail.expired')
                          : formatBufferCountdown(extractor.expiresInHrs) ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PiCollapsiblePanel>
          ) : null}

        </div>
      </DialogContent>
    </Dialog>
  )
}
