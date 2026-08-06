'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, Package, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { Button } from '@/components/ui/button'
import { formatUnits } from '@/lib/pi-v2/format'
import { formatBufferCountdown, formatPiRate } from '@/lib/pi/format'
import type { WarehouseContainerConfig, WarehouseView as WarehouseData } from '@/lib/pi-v2/warehouse'
import { HelpTip } from './HelpTip'
import { PiV2ItemIcon } from './PiV2ItemIcon'
import { TierBadge } from './TierBadge'

/**
 * Armazém de PI — o estoque que está no container, não no planeta.
 *
 * Fecha a limitação que a lista de compra carregava desde a Etapa 3: ela descontava
 * só o material DENTRO das colônias, e o que estava parado num container da base
 * ficava invisível.
 *
 * ⚠️ **Esta entrega LÊ e MOSTRA, ainda não desconta.** O desconto na lista entra
 * depois que os números aqui forem conferidos contra o jogo — descontar sobre
 * leitura errada faria o jogador comprar de menos e parar colônias. A tela diz isso
 * em vez de deixar parecer que a lista já mudou.
 */

/** Um candidato como o endpoint devolve. */
interface Candidate {
  itemId: number
  name: string
  typeId: number
  characterId: number
  characterName: string
  locationName: string
  locationId: number
  atBase: boolean
  piTypeCount: number
  otherTypeCount: number
}

const CONTAINER_TONE: Record<string, string> = {
  ok: 'text-zinc-300',
  empty: 'text-zinc-500',
  not_found: 'text-amber-300',
  no_scope: 'text-amber-300',
  fetch_failed: 'text-orange-300',
}

const ITEM_TONE: Record<string, string> = {
  ok: 'text-zinc-300',
  running_low: 'text-amber-300',
  missing: 'text-red-300',
  not_consumed: 'text-zinc-500',
}

/** Autonomia em dias, ou o rótulo de "não é consumido" — que não é o mesmo que infinito. */
function AutonomyCell({ hrs }: { hrs: number | null }) {
  const { t } = useTranslations()
  if (hrs == null) {
    return <span className="text-[10px] text-zinc-600">{t('piV2.warehouse.notConsumed')}</span>
  }
  return (
    <span className="tabular-nums">
      {formatBufferCountdown(hrs) ?? '0m'}
      <span className="ml-1 text-[10px] text-zinc-600">
        {t('piV2.warehouse.days', { days: (hrs / 24).toFixed(1) })}
      </span>
    </span>
  )
}

function ContainerPicker({
  baseId,
  selected,
  onChange,
}: {
  baseId?: string | null
  selected: WarehouseContainerConfig[]
  onChange: (next: WarehouseContainerConfig[]) => void
}) {
  const { t } = useTranslations()
  const [candidates, setCandidates] = useState<Candidate[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [withoutScope, setWithoutScope] = useState<number[]>([])

  // Sob demanda: listar candidatos varre os assets de TODOS os personagens, e isso
  // não pode acontecer no load da tela.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const qs = baseId ? `?baseId=${encodeURIComponent(baseId)}` : ''
        const res = await fetch(`/api/pi-v2/warehouse/containers${qs}`)
        if (!res.ok) throw new Error('failed')
        const data = await res.json()
        if (cancelled) return
        setCandidates(Array.isArray(data.candidates) ? data.candidates : [])
        setWithoutScope(Array.isArray(data.charactersWithoutScope) ? data.charactersWithoutScope : [])
      } catch {
        if (!cancelled) setError(t('piV2.warehouse.candidatesFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [baseId, t])

  const isSelected = (c: Candidate) =>
    selected.some((s) => s.itemId === c.itemId && s.characterId === c.characterId)

  const toggle = (c: Candidate) => {
    if (isSelected(c)) {
      onChange(selected.filter((s) => !(s.itemId === c.itemId && s.characterId === c.characterId)))
      return
    }
    onChange([
      ...selected,
      {
        itemId: c.itemId,
        characterId: c.characterId,
        name: c.name,
        locationName: c.locationName,
      },
    ])
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
        <Package className="h-3 w-3" />
        {t('piV2.warehouse.pickTitle')}
        <HelpTip title={t('piV2.warehouse.pickTitle')}>
          <p>{t('piV2.warehouse.pickHelp')}</p>
        </HelpTip>
      </p>

      {loading ? (
        <p className="flex items-center gap-2 text-[11px] text-zinc-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-300" />
          {t('piV2.warehouse.candidatesLoading')}
        </p>
      ) : null}

      {error ? <p className="text-[11px] text-red-300">{error}</p> : null}

      {withoutScope.length > 0 ? (
        // Sem o scope o personagem não desaparece da conta: a tela pede a
        // re-autorização, que é a ação que resolve.
        <p className="mb-2 flex items-start gap-1.5 rounded border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
          {t('piV2.warehouse.missingScope', { count: withoutScope.length })}
        </p>
      ) : null}

      {candidates && candidates.length === 0 && !loading ? (
        <p className="text-[11px] text-zinc-500">{t('piV2.warehouse.noCandidates')}</p>
      ) : null}

      {candidates && candidates.length > 0 ? (
        <ul className="space-y-0.5">
          {candidates.map((c) => (
            <li key={`${c.characterId}-${c.itemId}`}>
              <button
                type="button"
                onClick={() => toggle(c)}
                aria-pressed={isSelected(c)}
                className={cn(
                  'flex w-full flex-wrap items-center gap-x-2 rounded px-1.5 py-1 text-left text-[11px] transition-colors',
                  isSelected(c)
                    ? 'bg-violet-500/15 text-violet-100'
                    : 'text-zinc-300 hover:bg-zinc-800/60'
                )}
              >
                <span className="min-w-0 truncate font-medium">{c.name}</span>
                <span className="text-zinc-500">{c.characterName}</span>
                <span className="min-w-0 truncate text-zinc-600">{c.locationName}</span>
                {c.atBase ? (
                  <span className="rounded bg-emerald-500/15 px-1 py-px text-[10px] text-emerald-300">
                    {t('piV2.warehouse.atBase')}
                  </span>
                ) : null}
                <span className="ml-auto shrink-0 tabular-nums text-zinc-500">
                  {t('piV2.warehouse.contents', { pi: c.piTypeCount, other: c.otherTypeCount })}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}

export function WarehouseView({
  data,
  containers,
  baseHub,
  loading,
  onContainersChange,
}: {
  data?: WarehouseData
  containers: WarehouseContainerConfig[]
  baseHub: { id: string; name: string } | null
  loading?: boolean
  onContainersChange: (next: WarehouseContainerConfig[]) => void
}) {
  const { t } = useTranslations()
  const [picking, setPicking] = useState(containers.length === 0)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPicking((v) => !v)}
          aria-pressed={picking}
          className={cn('gap-1.5', picking && 'border-violet-400/40 text-violet-200')}
        >
          <Package className="h-3.5 w-3.5" />
          {t('piV2.warehouse.pickButton', { count: containers.length })}
        </Button>
        {data ? (
          <span className="text-[11px] text-zinc-500">
            {t('piV2.warehouse.readAt', {
              time: new Date(data.fetchedAt).toLocaleTimeString(),
            })}
          </span>
        ) : null}
      </div>

      {/* O aviso mais importante da tela nesta entrega. */}
      <p className="rounded-lg border border-sky-500/30 bg-sky-500/10 p-2.5 text-[11px] text-sky-200">
        {t('piV2.warehouse.notDiscountedYet')}
      </p>

      {picking ? (
        <ContainerPicker
          baseId={baseHub?.id}
          selected={containers}
          onChange={onContainersChange}
        />
      ) : null}

      {containers.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">{t('piV2.warehouse.empty')}</p>
      ) : null}

      {loading && !data ? (
        <div className="flex min-h-[120px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-violet-300" />
        </div>
      ) : null}

      {data ? (
        <>
          {/* Estado de cada container: vazio e não-encontrado são coisas diferentes. */}
          <div className="space-y-1">
            {data.containers.map((c) => (
              <div
                key={`${c.characterId}-${c.itemId}`}
                className="flex flex-wrap items-center gap-x-2 rounded border border-zinc-800/80 bg-zinc-950/40 px-2.5 py-1.5 text-[11px]"
              >
                <span className={cn('min-w-0 truncate font-medium', CONTAINER_TONE[c.state])}>
                  {c.name}
                </span>
                <span className="text-zinc-600">·</span>
                <span className={CONTAINER_TONE[c.state]}>
                  {t(`piV2.warehouse.state.${c.state}`)}
                </span>
                {c.state === 'ok' ? (
                  <span className="text-zinc-500">
                    {t('piV2.warehouse.contents', {
                      pi: c.piTypeCount,
                      other: c.otherTypeCount,
                    })}
                  </span>
                ) : null}
                {c.anomalies > 0 ? (
                  <span className="text-amber-300">
                    {t('piV2.warehouse.anomalies', { count: c.anomalies })}
                  </span>
                ) : null}
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={t('piV2.warehouse.remove', { name: c.name })}
                  onClick={() =>
                    onContainersChange(
                      containers.filter(
                        (s) => !(s.itemId === c.itemId && s.characterId === c.characterId)
                      )
                    )
                  }
                  className="ml-auto h-6 w-6 shrink-0 p-0 text-zinc-500 hover:text-red-300"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>

          {data.incomplete ? (
            // Aqui o erro inverte de direção: deixar de contar estoque faz comprar
            // em excesso, não faltar. Menos grave — e ainda tem que ser dito.
            <p className="flex items-start gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-200">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
              {t('piV2.warehouse.incomplete')}
            </p>
          ) : null}

          {data.items.length === 0 ? (
            <p className="py-6 text-center text-[11px] text-zinc-500">
              {t('piV2.warehouse.noItems')}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-xs">
                <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="py-1 text-left font-medium">{t('piV2.warehouse.item')}</th>
                    <th className="py-1 text-right font-medium">{t('piV2.warehouse.inStock')}</th>
                    <th className="py-1 text-right font-medium">
                      {t('piV2.warehouse.consumption')}
                    </th>
                    <th className="py-1 text-right font-medium">
                      <span className="inline-flex items-center gap-1">
                        {t('piV2.warehouse.autonomy')}
                        <HelpTip title={t('piV2.warehouse.autonomy')}>
                          <p>{t('piV2.warehouse.autonomyHelp')}</p>
                        </HelpTip>
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.typeId} className="border-t border-zinc-800/60">
                      <td className="py-1 pr-2">
                        <span className="flex items-center gap-1.5">
                          <PiV2ItemIcon typeId={item.typeId} name={item.name} />
                          <span className="min-w-0 truncate text-zinc-200">{item.name}</span>
                          <TierBadge tier={item.tier} />
                          {item.state === 'missing' || item.state === 'running_low' ? (
                            <span className={cn('text-[10px]', ITEM_TONE[item.state])}>
                              {t(`piV2.warehouse.itemState.${item.state}`)}
                            </span>
                          ) : null}
                        </span>
                      </td>
                      <td
                        className={cn(
                          'py-1 pr-2 text-right tabular-nums',
                          ITEM_TONE[item.state]
                        )}
                      >
                        {formatUnits(item.quantity)}
                      </td>
                      <td className="py-1 pr-2 text-right tabular-nums text-zinc-500">
                        {item.consumptionPerHour > 0
                          ? `${formatPiRate(item.consumptionPerHour)}/h`
                          : '—'}
                      </td>
                      <td className={cn('py-1 text-right', ITEM_TONE[item.state])}>
                        <AutonomyCell hrs={item.autonomyHrs} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[10px] text-zinc-600">{t('piV2.warehouse.footnote')}</p>
        </>
      ) : null}
    </div>
  )
}
