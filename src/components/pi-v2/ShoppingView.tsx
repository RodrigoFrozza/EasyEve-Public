'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Copy, Download, Loader2, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { formatIsk, formatM3, formatUnitPrice, formatUnits } from '@/lib/pi-v2/format'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { usePiV2Shopping } from '@/lib/hooks/use-pi-v2-shopping'
import { SHOPPING_PERIODS_HRS, toCsv, toMultibuy } from '@/lib/pi-v2/shopping-format'
import type { ShoppingLine } from '@/lib/pi-v2/shopping-types'
import { isPublicHubId, type BaseHub, type FreightHub } from '@/lib/pi-v2/pricing/freight-model'
import type { ContractFreight } from '@/lib/pi-v2/pricing/freight'
import { FreightHubsPanel } from './FreightHubsPanel'
import { HubChip } from './HubChip'
import { PiV2ItemIcon } from './PiV2ItemIcon'
import { TierBadge } from './TierBadge'

/**
 * Lista de compra — o que comprar, quanto, e onde.
 *
 * A tela mostra a **decomposição**, não só o total: preço da mercadoria, frete e
 * efetivo, lado a lado com os hubs perdedores. Um número de compra sem a conta
 * atrás não dá para conferir, e este modelo foi construído sendo conferido.
 *
 * Importa de `shopping-format`/`shopping-types` (client-safe), nunca de
 * `shopping.ts` — este último alcança `market-prices` → `prisma`.
 */

const EMPTY = '—'

function hubName(origin: string, label: string | undefined, t: (k: string) => string): string {
  return label ?? t(`piV2.shopping.hub.${origin}`)
}

function safeFilename(label: string): string {
  return label.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'hub'
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function LineRow({ line }: { line: ShoppingLine }) {
  const { t } = useTranslations()
  const [open, setOpen] = useState(false)
  const chosen = line.chosen

  return (
    <>
      <tr
        className={cn(
          'cursor-pointer border-t border-zinc-800/60 hover:bg-zinc-900/60',
          line.short && 'bg-amber-500/5'
        )}
        onClick={() => setOpen((v) => !v)}
      >
        <td className="py-1 pr-2 text-zinc-200">
          <span className="flex items-center gap-1.5">
            <PiV2ItemIcon typeId={line.typeId} name={line.name} />
            <span className="min-w-0 truncate">{line.name}</span>
            <TierBadge tier={line.tier} />
          </span>
          {line.short ? (
            <span
              className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-amber-300"
              title={t('piV2.shopping.shortTooltip')}
            >
              <AlertTriangle className="h-3 w-3" />
              {t('piV2.shopping.short')}
            </span>
          ) : null}
        </td>
        <td className="py-1 pr-2 text-right tabular-nums">
          <span className={line.quantity > 0 ? 'text-zinc-300' : 'text-zinc-600'}>
            {formatUnits(line.quantity)}
          </span>
          {line.coveredByStock ? (
            <span className="block text-[10px] text-emerald-400/80">
              {t('piV2.shopping.covered')}
            </span>
          ) : null}
        </td>
        <td className="py-1 pr-2 text-right tabular-nums text-zinc-500">
          {line.warehouseQuantity > 0 ? formatUnits(line.warehouseQuantity) : EMPTY}
        </td>
        <td className="py-1 pr-2">
          {chosen ? (
            <HubChip
              origin={chosen.origin}
              stationId={chosen.stationId}
              label={hubName(chosen.origin, chosen.label, t)}
            />
          ) : (
            EMPTY
          )}
        </td>
        <td className="py-1 pr-2 text-right tabular-nums text-zinc-400">
          {chosen ? formatUnitPrice(chosen.unitPrice) : EMPTY}
        </td>
        <td className="py-1 pr-2 text-right tabular-nums text-zinc-500">
          {chosen && chosen.freightPerUnit > 0 ? `+${formatUnitPrice(chosen.freightPerUnit)}` : EMPTY}
        </td>
        <td className="py-1 pr-2 text-right font-medium tabular-nums text-zinc-200">
          {chosen ? formatUnitPrice(chosen.effectiveUnitPrice) : EMPTY}
        </td>
        <td className="py-1 pr-2 text-right tabular-nums text-zinc-200">
          {line.totalCost > 0 ? formatIsk(line.totalCost) : EMPTY}
        </td>
        <td className="py-1 text-right tabular-nums text-zinc-500">
          {formatM3(line.totalVolumeM3)}
        </td>
      </tr>

      {open ? (
        <tr className="border-t border-zinc-900 bg-zinc-950/60">
          <td colSpan={9} className="px-2 py-2">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-violet-300">
              {t('piV2.shopping.comparison')}
            </p>
            {line.quotes.length === 0 ? (
              <p className="text-[11px] text-zinc-500">{t('piV2.shopping.noBook')}</p>
            ) : (
              <ul className="space-y-0.5 text-[11px]">
                {line.quotes.map((q, i) => (
                  <li
                    key={`${q.origin}-${q.label ?? i}`}
                    className={cn(
                      'flex flex-wrap items-center gap-x-2 tabular-nums',
                      q === line.chosen ? 'text-zinc-200' : 'text-zinc-500'
                    )}
                  >
                    <HubChip
                      origin={q.origin}
                      stationId={q.stationId}
                      label={hubName(q.origin, q.label, t)}
                      className="w-32"
                    />
                    <span>
                      {formatUnitPrice(q.unitPrice)}
                      {q.freightPerUnit > 0
                        ? ` + ${formatUnitPrice(q.freightPerUnit)} ${t('piV2.shopping.freightShort')}`
                        : ''}
                      {' = '}
                      <strong>{formatUnitPrice(q.effectiveUnitPrice)}</strong>
                    </span>
                    {!q.coversDemand ? (
                      <span className="text-amber-300">
                        {t('piV2.shopping.covers', { filled: formatUnits(q.filledQty) })}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}

            {line.breakdown.length > 0 ? (
              <>
                <p className="mb-1 mt-2 text-[10px] font-bold uppercase tracking-wider text-violet-300">
                  {t('piV2.shopping.demandFrom')}
                </p>
                <ul className="space-y-0.5 text-[11px] text-zinc-500">
                  {line.breakdown.slice(0, 8).map((b) => (
                    <li key={`${b.characterId}-${b.planetId}`} className="tabular-nums">
                      {b.characterName} · {b.planetName ?? b.planetId} · {formatUnits(b.quantity)}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </td>
        </tr>
      ) : null}
    </>
  )
}

export function ShoppingView({
  periodHours,
  baseHub,
  hubs,
  economy,
  onPeriodChange,
  onBaseChange,
  onHubsChange,
  onSeedLegacy,
  onRememberContract,
  onRecallContract,
}: {
  periodHours: number
  baseHub: BaseHub | null
  hubs: FreightHub[]
  /**
   * O resultado da economia, buscado UMA vez no nível acima e compartilhado com o
   * P&L do detalhe e com o NET do topo. Dois fetches produziriam os mesmos números
   * ao dobro do custo de ESI — e poderiam mostrar dois totais diferentes.
   */
  economy: ReturnType<typeof usePiV2Shopping>
  onPeriodChange: (hours: number) => void
  onBaseChange: (base: BaseHub | null) => void
  onHubsChange: (next: FreightHub[]) => void
  onSeedLegacy: (legacy: Array<{ id: string; name: string }>) => void
  onRememberContract: (hubId: string, contract: ContractFreight) => void
  onRecallContract: (hubId: string, transporter: string) => ContractFreight | undefined
}) {
  const { t } = useTranslations()
  const [showStations, setShowStations] = useState(false)
  /**
   * Qual botão acabou de copiar. Booleano não serve mais: com um copiar por hub,
   * um "Copiado" solto acenderia em todos ao mesmo tempo e o jogador não saberia
   * o que está na área de transferência antes de colar no jogo.
   */
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  /**
   * Hub em foco. **Comprar é uma ida por hub**: estando em Jita, a lista inteira
   * atrapalha — o que importa é o que se compra ali. `null` = a lista toda.
   */
  const [hubFilter, setHubFilter] = useState<string | null>(null)
  /**
   * Bruto (default) ou líquido do Armazém de PI. Começa em bruto de propósito:
   * o jogador escolhe ativamente ver menos, nunca é surpreendido com um número
   * menor por um desconto ligado sozinho.
   */
  const [netOfWarehouse, setNetOfWarehouse] = useState(false)
  const { data, loading, refreshing, error, refetch } = economy
  const hasWarehouseList = data?.listNetOfWarehouse != null
  // A lista ativa: líquida só quando o jogador pediu E ela existe (armazém
  // configurado). Nunca aplicamos o desconto sozinhos.
  const view = netOfWarehouse && data?.listNetOfWarehouse ? data.listNetOfWarehouse : data

  // Migração de quem já tinha as duas estruturas fixas configuradas no perfil:
  // o servidor diz QUAIS eram, o hook aplica uma única vez (não sobrescreve
  // config existente). Sem isto, a config antiga sumiria da tela nova.
  const legacy = data?.legacyStations
  // Critério: sem base e sem hub de ESTRUTURA. O frete de Jita/Região pode já ter
  // migrado sozinho do localStorage antigo, e isso não é config de estrutura.
  const noStructuresYet = !baseHub && !hubs.some((hub) => !isPublicHubId(hub.id))
  useEffect(() => {
    if (legacy && legacy.length > 0 && noStructuresYet) onSeedLegacy(legacy)
  }, [legacy, noStructuresYet, onSeedLegacy])

  const copyMultibuy = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedKey(key)
      setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1500)
    } catch {
      // clipboard bloqueado (http, permissão) — o CSV continua sendo saída válida
    }
  }

  // O hub em foco some quando o cálculo muda (outro período, outra config, ou
  // troca de visão bruta/líquida) e ele deixa de existir — senão a tabela
  // ficaria vazia sem explicação.
  const activeBucket = view?.byHub.find((b) => b.hubKey === hubFilter) ?? null
  const activeLines = activeBucket ? activeBucket.lines : (view?.lines ?? [])
  const activeLabel = activeBucket
    ? hubName(activeBucket.origin, activeBucket.label, t)
    : null
  /**
   * Linhas que nenhum hub cotou (sem book e sem referência). Elas não estão em
   * bucket nenhum, então a soma dos hubs NÃO é a lista toda — e isso tem que ser
   * dito, ou o jogador acha que comprou tudo.
   */
  const unbucketedCount = view
    ? view.lines.filter((l) => l.quantity > 0 && !l.chosen).length
    : 0

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={String(periodHours)} onValueChange={(v) => onPeriodChange(Number(v))}>
          <SelectTrigger className="w-[170px] border-zinc-800 bg-zinc-900">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="border-zinc-800 bg-zinc-900">
            {SHOPPING_PERIODS_HRS.map((h) => (
              <SelectItem key={h} value={String(h)}>
                {t('piV2.shopping.period', { hours: h })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowStations((v) => !v)}
          aria-pressed={showStations}
          className={cn('gap-1.5', showStations && 'border-violet-400/40 text-violet-200')}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          {t('piV2.shopping.hubs.button', { count: hubs.length + (baseHub ? 1 : 0) })}
        </Button>

        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={refreshing}>
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : t('piV2.refresh')}
        </Button>

        {hasWarehouseList ? (
          // O jogador escolhe a visão — nunca um desconto ligado sozinho. Os
          // dois botões deixam claro qual está ativa, sem esconder a outra atrás
          // de um switch cujo estado não se lê de relance.
          <div className="flex overflow-hidden rounded-lg border border-zinc-800">
            <button
              type="button"
              aria-pressed={!netOfWarehouse}
              onClick={() => setNetOfWarehouse(false)}
              className={cn(
                'px-2.5 py-1.5 text-xs transition-colors',
                !netOfWarehouse ? 'bg-violet-500/15 text-violet-200' : 'text-zinc-400 hover:bg-zinc-900'
              )}
            >
              {t('piV2.shopping.warehouseView.gross')}
            </button>
            <button
              type="button"
              aria-pressed={netOfWarehouse}
              onClick={() => setNetOfWarehouse(true)}
              className={cn(
                'px-2.5 py-1.5 text-xs transition-colors',
                netOfWarehouse ? 'bg-violet-500/15 text-violet-200' : 'text-zinc-400 hover:bg-zinc-900'
              )}
            >
              {t('piV2.shopping.warehouseView.net')}
            </button>
          </div>
        ) : null}

        {view && view.lines.length > 0 ? (
          <>
            {/* Com um hub em foco, os botões do topo seguem o foco: um "copiar
                tudo" que copia outra coisa do que está na tela seria armadilha. */}
            <Button
              variant="outline"
              size="sm"
              className="ml-auto gap-1.5"
              onClick={() => void copyMultibuy('all', toMultibuy(activeLines))}
            >
              <Copy className="h-3.5 w-3.5" />
              {copiedKey === 'all'
                ? t('piV2.shopping.copied')
                : activeLabel
                  ? t('piV2.shopping.multibuyHub', { hub: activeLabel })
                  : t('piV2.shopping.multibuy')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() =>
                download(
                  `pi-shopping-${activeBucket ? `${safeFilename(activeLabel!)}-` : ''}${periodHours}h.csv`,
                  toCsv(activeLines)
                )
              }
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
          </>
        ) : null}
      </div>

      {showStations ? (
        <FreightHubsPanel
          baseHub={baseHub}
          hubs={hubs}
          warnings={data?.stationWarnings ?? []}
          jfPlans={data?.jfPlans ?? []}
          onBaseChange={onBaseChange}
          onHubsChange={onHubsChange}
          onRememberContract={onRememberContract}
          onRecallContract={onRecallContract}
        />
      ) : null}

      {!baseHub ? (
        // Sem base não há "até onde": todo frete é até ela. A lista ainda calcula
        // (com os hubs que houver), mas o jogador precisa saber o que falta.
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
          {t('piV2.shopping.hubs.baseMissing')}
        </div>
      ) : null}

      {data && data.stationWarnings.length > 0 ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
          {t('piV2.shopping.stationsDropped', {
            names: data.stationWarnings.map((w) => w.name).join(', '),
          })}
        </div>
      ) : null}

      {netOfWarehouse && data?.warehouse?.incomplete ? (
        // Container que não pôde ser lido não conta no desconto — a visão
        // líquida pode estar pedindo mais do que o necessário, nunca menos.
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
          {t('piV2.shopping.warehouseView.incomplete')}
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex min-h-[160px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-violet-300" />
        </div>
      ) : null}

      {view ? (
        view.lines.length === 0 ? (
          <p className="py-10 text-center text-sm text-zinc-500">{t('piV2.shopping.empty')}</p>
        ) : (
          <>
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span className="font-semibold text-zinc-100">{formatIsk(view.totalCost)}</span>
                <span className="text-xs text-zinc-500">
                  {t('piV2.shopping.goodsPlusFreight', {
                    goods: formatIsk(view.goodsCost),
                    freight: formatIsk(view.freightCost),
                  })}
                </span>
                <span className="text-xs text-zinc-500">
                  {formatM3(view.totalVolumeM3)} m³ ·{' '}
                  {t('piV2.shopping.items', { count: view.lines.length })}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                {view.byHub.map((b) => (
                  <span
                    key={b.hubKey}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-1.5 py-1 text-xs text-zinc-400 transition-colors',
                      hubFilter === b.hubKey
                        ? 'border-violet-400/40 bg-violet-500/10'
                        : 'border-transparent'
                    )}
                  >
                    {/* Clicar no hub foca a lista nele — é a ida que ele vai fazer. */}
                    <button
                      type="button"
                      aria-pressed={hubFilter === b.hubKey}
                      title={t('piV2.shopping.hubs.filterTooltip')}
                      onClick={() =>
                        setHubFilter((current) => (current === b.hubKey ? null : b.hubKey))
                      }
                      className="flex items-center gap-1.5"
                    >
                      <HubChip
                        origin={b.origin}
                        stationId={b.stationId}
                        label={hubName(b.origin, b.label, t)}
                      />
                      <span className="tabular-nums">{formatIsk(b.cost)}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={t('piV2.shopping.multibuyHub', {
                        hub: hubName(b.origin, b.label, t),
                      })}
                      title={t('piV2.shopping.multibuyHub', {
                        hub: hubName(b.origin, b.label, t),
                      })}
                      onClick={() => void copyMultibuy(b.hubKey, toMultibuy(b.lines))}
                      className="rounded p-0.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-violet-200"
                    >
                      {copiedKey === b.hubKey ? (
                        <Check className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={t('piV2.shopping.csvHub', {
                        hub: hubName(b.origin, b.label, t),
                      })}
                      title={t('piV2.shopping.csvHub', { hub: hubName(b.origin, b.label, t) })}
                      onClick={() =>
                        download(
                          `pi-shopping-${safeFilename(hubName(b.origin, b.label, t))}-${periodHours}h.csv`,
                          toCsv(b.lines)
                        )
                      }
                      className="rounded p-0.5 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-violet-200"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    {b.freightCost > 0 ? (
                      <span className="text-[11px] text-zinc-500">
                        {t('piV2.shopping.freightPart', { freight: formatIsk(b.freightCost) })}
                      </span>
                    ) : null}
                    {b.freight && b.freight.trips != null && b.freight.trips > 1 ? (
                      // Mais de uma viagem: o custo do JF é fixo por ida, então o
                      // volume que não cabe não vem de graça.
                      <span className="rounded bg-zinc-700/40 px-1 py-px text-[10px] text-zinc-300">
                        {t('piV2.shopping.jf.trips', { count: b.freight.trips })}
                      </span>
                    ) : null}
                    {b.freight && b.freight.binding !== 'per_m3' && b.freight.binding !== 'none' ? (
                      // Quando o teto, o piso ou o combustível manda, o total deixa
                      // de ser volume × per m³ — e o jogador precisa saber por quê.
                      <span
                        className={cn(
                          'rounded px-1 py-px text-[10px]',
                          b.freight.unpriced
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-zinc-700/40 text-zinc-300'
                        )}
                        title={t('piV2.shopping.bindingTooltip')}
                      >
                        {t(`piV2.shopping.binding.${b.freight.binding}`)}
                      </span>
                    ) : null}
                    {b.rateNote === 'unconfigured' ? (
                      <span
                        className="rounded bg-amber-500/15 px-1 py-px text-[10px] text-amber-300"
                        title={t('piV2.shopping.hubs.notConfiguredTooltip')}
                      >
                        {t('piV2.shopping.hubs.notConfigured')}
                      </span>
                    ) : null}
                  </span>
                ))}
              </div>
            </div>

            {view.unpricedTypeIds.length > 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
                {t('piV2.shopping.unpriced', { count: view.unpricedTypeIds.length })}
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="py-1 text-left font-medium">{t('piV2.shopping.item')}</th>
                    <th className="py-1 text-right font-medium">{t('piV2.shopping.qty')}</th>
                    <th className="py-1 text-right font-medium">{t('piV2.shopping.inStock')}</th>
                    <th className="py-1 text-left font-medium">{t('piV2.shopping.hubCol')}</th>
                    <th className="py-1 text-right font-medium">{t('piV2.shopping.price')}</th>
                    <th className="py-1 text-right font-medium">{t('piV2.shopping.freight')}</th>
                    <th className="py-1 text-right font-medium">{t('piV2.shopping.effective')}</th>
                    <th className="py-1 text-right font-medium">{t('piV2.shopping.total')}</th>
                    <th className="py-1 text-right font-medium">m³</th>
                  </tr>
                </thead>
                <tbody>
                  {activeLines.map((line) => (
                    <LineRow key={line.typeId} line={line} />
                  ))}
                </tbody>
              </table>
            </div>
            {activeBucket ? (
              // Filtro é estado escondido em potencial: o jogador precisa ver que
              // está olhando uma parte, e ter o caminho de volta na mesma frase.
              <p className="flex flex-wrap items-center gap-2 text-[11px] text-violet-200">
                {t('piV2.shopping.hubs.filtered', {
                  hub: activeLabel!,
                  shown: activeLines.length,
                  total: view.lines.length,
                })}
                <button
                  type="button"
                  onClick={() => setHubFilter(null)}
                  className="underline underline-offset-2 hover:text-violet-100"
                >
                  {t('piV2.shopping.hubs.clearFilter')}
                </button>
              </p>
            ) : null}
            {unbucketedCount > 0 ? (
              // A soma dos hubs não é a lista toda quando há item sem cotação.
              <p className="text-[11px] text-amber-200">
                {t('piV2.shopping.hubs.unbucketed', { count: unbucketedCount })}
              </p>
            ) : null}
            <p className="text-[10px] text-zinc-600">{t('piV2.shopping.stockNote')}</p>
            <p className="text-[10px] text-zinc-600">{t('piV2.shopping.footnote')}</p>
          </>
        )
      ) : null}
    </div>
  )
}
