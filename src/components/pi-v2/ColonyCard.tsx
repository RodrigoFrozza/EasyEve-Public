'use client'

import {
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  PackageOpen,
  RefreshCw,
  Scale,
  Truck,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { formatBufferCountdown } from '@/lib/pi/format'
import type { PortfolioColony } from '@/lib/pi-v2/portfolio'
import type { ColonyAction, ColonyBucket } from '@/lib/pi-v2/urgency'
import { PiPlanetIcon } from '@/components/pi/PiPlanetIcon'
import { StalenessSeal } from './StalenessSeal'
import { PiV2ItemIcon } from './PiV2ItemIcon'

/**
 * Card de colônia — 3 linhas, para 32+ caberem numa tela.
 *
 * A linha do meio é a ÚNICA que muda de tom: é a ação. O jogador varre a coluna
 * de ações, não os nomes. Nome e contexto ficam em cinza para não competir.
 */

const BUCKET_TONE: Record<ColonyBucket, { border: string; text: string; icon: LucideIcon }> = {
  stalled: { border: 'border-red-500/40', text: 'text-red-300', icon: AlertOctagon },
  losing: { border: 'border-orange-500/40', text: 'text-orange-300', icon: PackageOpen },
  degraded: { border: 'border-amber-500/30', text: 'text-amber-300', icon: AlertTriangle },
  attention: { border: 'border-yellow-500/25', text: 'text-yellow-300', icon: AlertTriangle },
  restock_soon: { border: 'border-sky-500/20', text: 'text-sky-300', icon: Truck },
  running: { border: 'border-zinc-800', text: 'text-emerald-400/80', icon: CheckCircle2 },
}

const ACTION_ICON: Record<ColonyAction['kind'], LucideIcon> = {
  open_in_game: Eye,
  restart_extractor: RefreshCw,
  restock: Truck,
  collect: PackageOpen,
  rebalance_production: Scale,
  none: CheckCircle2,
}

/**
 * Texto da ação: **o que fazer e quando**, nesta ordem. "Repor Water · em 2h"
 * responde a pergunta; "starving_soon" só nomeia o diagnóstico.
 */
export function useActionLabel() {
  const { t } = useTranslations()

  return (action: ColonyAction): { text: string; due: string | null } => {
    const due =
      action.dueInHours == null
        ? null
        : action.dueInHours <= 0
          ? t('piV2.action.overdue')
          : t('piV2.action.inTime', { time: formatBufferCountdown(action.dueInHours) ?? '0m' })

    switch (action.kind) {
      case 'restock':
        return {
          text: action.typeName
            ? t('piV2.action.restockItem', { item: action.typeName })
            : t('piV2.action.restock'),
          due,
        }
      case 'collect':
        return {
          text: action.pinLabel
            ? t('piV2.action.collectFrom', { pin: action.pinLabel })
            : t('piV2.action.collect'),
          due,
        }
      case 'restart_extractor':
        return {
          text: action.typeName
            ? t('piV2.action.restartExtractorItem', { item: action.typeName })
            : t('piV2.action.restartExtractor'),
          due,
        }
      case 'rebalance_production':
        return {
          text: action.typeName
            ? t('piV2.action.rebalanceProductionItem', { item: action.typeName })
            : t('piV2.action.rebalanceProduction'),
          due,
        }
      case 'open_in_game':
        return { text: t('piV2.action.openInGame'), due: null }
      case 'none':
        return { text: t('piV2.action.none'), due: null }
    }
  }
}

export function ColonyCard({
  colony,
  onClick,
}: {
  colony: PortfolioColony
  onClick: () => void
}) {
  const { t } = useTranslations()
  const actionLabel = useActionLabel()

  const { urgency, projection } = colony
  const tone = BUCKET_TONE[urgency.bucket]
  const ActionIcon = ACTION_ICON[urgency.action.kind]
  const { text, due } = actionLabel(urgency.action)
  const title = colony.planetName ?? colony.solarSystemName

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full flex-col gap-1 rounded-lg border bg-zinc-900/60 p-2.5 text-left transition-colors hover:bg-zinc-800/60',
        tone.border
      )}
    >
      {/* 1 — identidade + confiança do dado */}
      <div className="flex items-center gap-2">
        <PiPlanetIcon planetType={colony.planetType} label={colony.planetTypeLabel} size={22} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-200">{title}</span>
        <StalenessSeal confidence={projection.confidence} />
      </div>

      {/* 2 — a ação. A única linha com cor. */}
      <div className={cn('flex items-center gap-1.5 text-xs font-medium', tone.text)}>
        {/* Quando a ação nomeia um item, o ícone dele vem junto: o jogador
            reconhece "Water" pela imagem antes de ler a palavra. */}
        {urgency.action.typeId ? (
          <PiV2ItemIcon typeId={urgency.action.typeId} name={urgency.action.typeName} size={16} />
        ) : (
          <ActionIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
        )}
        <span className="min-w-0 truncate">{text}</span>
        {due ? (
          <span className="ml-auto flex shrink-0 items-center gap-1 tabular-nums">
            <Clock className="h-3 w-3" aria-hidden />
            {due}
          </span>
        ) : null}
      </div>

      {/* 3 — contexto, deliberadamente apagado */}
      <p className="truncate text-[11px] text-zinc-500">
        {colony.characterName} · {colony.solarSystemName}
        {projection.status.status !== 'running'
          ? ` · ${t(`piV2.status.${projection.status.status}`)}`
          : ''}
      </p>
    </button>
  )
}
