'use client'

import { useMemo, useState } from 'react'
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Copy,
  Download,
  Loader2,
  Rocket,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { Button } from '@/components/ui/button'
import { formatM3, formatUnits } from '@/lib/pi-v2/format'
import { toMultibuy } from '@/lib/pi-v2/shopping-format'
import { buildDelivery, toDeliveryCsv, type DeliveryItem } from '@/lib/pi-v2/delivery'
import type { ShoppingLine } from '@/lib/pi-v2/shopping-types'
import { HelpTip } from './HelpTip'
import { PiV2ItemIcon } from './PiV2ItemIcon'
import { TierBadge } from './TierBadge'

/**
 * Entrega — **o que levar para cada personagem, e para cada planeta dele.**
 *
 * A lista de compra é agrupada por HUB, porque é assim que se compra. Esta tela é
 * o outro lado da mesma rodada: com o material já em mãos, o agrupamento útil é o
 * de DESTINO — logar no personagem, carregar o que os planetas dele consomem,
 * subir. Cada seção tem o próprio multibuy, que é o que fecha o ciclo (a janela
 * de transferência do jogo aceita o mesmo formato).
 *
 * ⚠️ **A quantidade aqui é BRUTA**: o consumo do período, sem descontar o que já
 * está no launchpad. A lista de compra desconta; a entrega, não. Os dois totais
 * não batem de propósito, e o rodapé diz isso.
 *
 * **Tudo começa colapsado.** Com muitos personagens a tela virava uma parede de
 * tabelas abertas — o resumo do topo e o cabeçalho de cada bloco já dizem o
 * essencial (quanto, quantos itens) sem precisar abrir nada. "Marcar como
 * entregue" é estado só desta visita à tela (não persiste): serve para quem faz
 * a volta de personagem em personagem sem perder onde parou, não é um registro.
 */

function download(filename: string, content: string) {
  // BOM na frente para o Excel ler nome acentuado como UTF-8.
  const blob = new Blob(['﻿' + content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function safeFilename(label: string): string {
  return label.replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '') || 'entrega'
}

function ItemTable({ items }: { items: DeliveryItem[] }) {
  const { t } = useTranslations()
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[320px] text-xs">
        <thead className="text-[10px] uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="py-1 text-left font-medium">{t('piV2.delivery.item')}</th>
            <th className="py-1 text-right font-medium">{t('piV2.delivery.qty')}</th>
            <th className="py-1 text-right font-medium">m³</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.typeId} className="border-t border-zinc-800/60">
              <td className="py-1 pr-2">
                <span className="flex items-center gap-1.5">
                  <PiV2ItemIcon typeId={item.typeId} name={item.name} />
                  <span className="min-w-0 truncate text-zinc-200">{item.name}</span>
                  <TierBadge tier={item.tier} />
                </span>
              </td>
              <td className="py-1 pr-2 text-right font-medium tabular-nums text-zinc-200">
                {formatUnits(item.quantity)}
              </td>
              <td className="py-1 text-right tabular-nums text-zinc-500">
                {formatM3(item.totalVolumeM3)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Prévia de até 3 itens quando o bloco está colapsado — dá contexto ("o que tem
 * aqui") sem precisar abrir. Maior volume primeiro: é o que mais pesa na carga.
 */
function CollapsedPreview({ items }: { items: DeliveryItem[] }) {
  const top = [...items].sort((a, b) => b.totalVolumeM3 - a.totalVolumeM3).slice(0, 3)
  const rest = items.length - top.length
  return (
    <p className="mt-1 truncate text-[11px] text-zinc-500">
      {top.map((i) => i.name).join(', ')}
      {rest > 0 ? ` +${rest}` : ''}
    </p>
  )
}

/**
 * Uma remessa: um personagem inteiro, ou um planeta dele. As duas têm a mesma
 * forma — título, volume, copiar, CSV, tabela — porque são a mesma pergunta em
 * duas granularidades. Aberto/fechado e feito/pendente vêm de fora: o pai
 * precisa controlar todos de uma vez (expandir tudo, contar quantos faltam).
 */
function Shipment({
  id,
  title,
  subtitle,
  items,
  totalVolumeM3,
  copiedKey,
  onCopy,
  open,
  onToggleOpen,
  done,
  onToggleDone,
  nested = false,
}: {
  id: string
  title: string
  subtitle?: string
  items: DeliveryItem[]
  totalVolumeM3: number
  copiedKey: string | null
  onCopy: (key: string, text: string) => void
  open: boolean
  onToggleOpen: () => void
  done: boolean
  onToggleDone: () => void
  nested?: boolean
}) {
  const { t } = useTranslations()

  return (
    <div
      className={cn(
        'rounded-xl border bg-zinc-900/40 p-3 transition-opacity',
        nested ? 'border-zinc-800/60' : 'border-zinc-800',
        done && 'opacity-50'
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onToggleOpen}
          aria-expanded={open}
          className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-eve-text"
        >
          {open ? (
            <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" />
          ) : (
            <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />
          )}
          <span className={cn('truncate', done && 'line-through decoration-zinc-600')}>
            {title}
          </span>
          {subtitle ? (
            <span className="shrink-0 text-xs font-normal text-zinc-500">{subtitle}</span>
          ) : null}
        </button>
        <div className="flex shrink-0 items-center gap-2">
          <span className="text-[11px] tabular-nums text-zinc-500">
            {t('piV2.delivery.itemsAndVolume', {
              count: items.length,
              volume: formatM3(totalVolumeM3),
            })}
          </span>
          <button
            type="button"
            aria-pressed={done}
            title={t(done ? 'piV2.delivery.unmarkDelivered' : 'piV2.delivery.markDelivered')}
            aria-label={t(done ? 'piV2.delivery.unmarkDelivered' : 'piV2.delivery.markDelivered')}
            onClick={onToggleDone}
            className="rounded p-1 text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-emerald-300"
          >
            {done ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <Circle className="h-4 w-4" />
            )}
          </button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 px-2"
            onClick={() => onCopy(id, toMultibuy(items))}
          >
            {copiedKey === id ? (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copiedKey === id ? t('piV2.shopping.copied') : t('piV2.delivery.copy')}
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label={t('piV2.delivery.csvFor', { name: title })}
            className="h-7 px-2"
            onClick={() => download(`pi-entrega-${safeFilename(title)}.csv`, toDeliveryCsv(items))}
          >
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {open ? <div className="mt-2">{<ItemTable items={items} />}</div> : <CollapsedPreview items={items} />}
    </div>
  )
}

export function DeliveryView({
  lines,
  periodHours,
  loading,
  error,
}: {
  /** As linhas da lista de compra — a entrega sai do `breakdown` delas. */
  lines: ShoppingLine[]
  periodHours: number
  loading?: boolean
  error?: string | null
}) {
  const { t } = useTranslations()
  /** Segregar por planeta, além de por personagem. Desligado: a carga sai junta. */
  const [byPlanet, setByPlanet] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  /** Vazio = tudo colapsado. É o estado inicial de propósito. */
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  /** Só desta visita à tela — não é um registro, é "onde eu parei" enquanto navega. */
  const [doneIds, setDoneIds] = useState<Set<string>>(new Set())

  const copy = (key: string, text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopiedKey(key)
        setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 1500)
      })
      .catch(() => {
        // clipboard bloqueado (http, permissão) — o CSV continua sendo saída válida
      })
  }

  const delivery = useMemo(() => buildDelivery(lines), [lines])

  // Os ids de todo bloco que a visão atual mostra — muda com `byPlanet`, porque
  // aí o destino vira o planeta, não o personagem.
  const visibleIds = useMemo(
    () =>
      byPlanet
        ? delivery.flatMap((c) => c.planets.map((p) => `${c.characterId}-${p.planetId}`))
        : delivery.map((c) => String(c.characterId)),
    [delivery, byPlanet]
  )

  const toggleOpen = (id: string) =>
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleDone = (id: string) =>
    setDoneIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allOpen = visibleIds.length > 0 && visibleIds.every((id) => openIds.has(id))
  const toggleAllOpen = () => setOpenIds(allOpen ? new Set() : new Set(visibleIds))

  // Resumo do topo: dá a escala da rodada sem precisar abrir nada, já que tudo
  // começa fechado.
  const distinctItemCount = useMemo(
    () => new Set(delivery.flatMap((c) => c.items.map((i) => i.typeId))).size,
    [delivery]
  )
  const totalVolumeM3 = useMemo(
    () => delivery.reduce((sum, c) => sum + c.totalVolumeM3, 0),
    [delivery]
  )
  const doneCount = visibleIds.filter((id) => doneIds.has(id)).length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-eve-text">
          <Rocket className="h-4 w-4 text-violet-300" />
          {t('piV2.delivery.title')}
          <HelpTip title={t('piV2.delivery.title')}>
            <p>{t('piV2.delivery.help')}</p>
          </HelpTip>
        </span>
        <span className="text-xs text-zinc-500">
          {t('piV2.delivery.period', { hours: periodHours })}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {delivery.length > 0 ? (
            <Button variant="outline" size="sm" onClick={toggleAllOpen}>
              {t(allOpen ? 'piV2.delivery.collapseAll' : 'piV2.delivery.expandAll')}
            </Button>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            aria-pressed={byPlanet}
            onClick={() => setByPlanet((v) => !v)}
            className={cn('gap-1.5', byPlanet && 'border-violet-400/40 text-violet-200')}
          >
            {t('piV2.delivery.byPlanet')}
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      {loading && lines.length === 0 ? (
        <div className="flex min-h-[160px] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-violet-300" />
        </div>
      ) : null}

      {!loading && delivery.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">{t('piV2.delivery.empty')}</p>
      ) : null}

      {delivery.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
          <span>
            {t(
              byPlanet ? 'piV2.delivery.summaryPlanets' : 'piV2.delivery.summaryCharacters',
              { count: visibleIds.length }
            )}
          </span>
          <span>·</span>
          <span>{t('piV2.delivery.summaryItems', { count: distinctItemCount })}</span>
          <span>·</span>
          <span>{formatM3(totalVolumeM3)} m³</span>
          {doneCount > 0 ? (
            <>
              <span>·</span>
              <span className="text-emerald-400/80">
                {t('piV2.delivery.deliveredCount', { done: doneCount, total: visibleIds.length })}
              </span>
            </>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-3">
        {delivery.map((character) =>
          byPlanet ? (
            <div key={character.characterId} className="space-y-2">
              <h2 className="text-sm font-semibold text-violet-200">{character.characterName}</h2>
              <div className="space-y-2 border-l border-zinc-800 pl-3">
                {character.planets.map((planet) => {
                  const id = `${character.characterId}-${planet.planetId}`
                  return (
                    <Shipment
                      key={id}
                      id={id}
                      // Nome quando a ESI resolveu; senão o id — nunca um rótulo inventado.
                      title={planet.planetName ?? String(planet.planetId)}
                      items={planet.items}
                      totalVolumeM3={planet.totalVolumeM3}
                      copiedKey={copiedKey}
                      onCopy={copy}
                      open={openIds.has(id)}
                      onToggleOpen={() => toggleOpen(id)}
                      done={doneIds.has(id)}
                      onToggleDone={() => toggleDone(id)}
                      nested
                    />
                  )
                })}
              </div>
            </div>
          ) : (
            <Shipment
              key={character.characterId}
              id={String(character.characterId)}
              title={character.characterName}
              subtitle={t('piV2.delivery.planetCount', { count: character.planets.length })}
              items={character.items}
              totalVolumeM3={character.totalVolumeM3}
              copiedKey={copiedKey}
              onCopy={copy}
              open={openIds.has(String(character.characterId))}
              onToggleOpen={() => toggleOpen(String(character.characterId))}
              done={doneIds.has(String(character.characterId))}
              onToggleDone={() => toggleDone(String(character.characterId))}
            />
          )
        )}
      </div>

      {delivery.length > 0 ? (
        <p className="text-[10px] text-zinc-600">{t('piV2.delivery.footnote')}</p>
      ) : null}
    </div>
  )
}
