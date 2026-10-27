'use client'

import { AlertTriangle } from 'lucide-react'
import { useState } from 'react'
import { cn, formatCurrencyValue } from '@/lib/utils'
import { formatPiRate } from '@/lib/pi/format'
import type { PiColonyAnalysis } from '@/lib/pi/types'
import { useTranslations } from '@/i18n/hooks'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ProductionChainView } from './ProductionChainView'
import { RecipeList } from './RecipeList'
import { BalanceTable } from './BalanceTable'
import { PinBufferStatusList } from './PinBufferStatusList'
import { StaleDataBadge } from './StaleDataBadge'
import { ProjectionSeal } from './ProjectionSeal'
import { PiPlanetIcon } from './PiPlanetIcon'
import { ColonyRoleBadge } from './ColonyRoleBadge'
import { PiFinancialBreakdown } from './PiFinancialBreakdown'
import { PiGridPanel } from './PiGridPanel'
import { PiCollapsiblePanel } from './PiCollapsiblePanel'
import { hasUnroutedProductionValuation } from '@/lib/pi/colony-valuation-warnings'
import {
  colonyExportRevenuePerHour,
  colonyExportTaxPerHour,
  colonyImportCostPerHour,
} from '@/lib/pi/rate-mode'

type Props = {
  colony: PiColonyAnalysis | null
  open: boolean
  onOpenChange: (open: boolean) => void
  rateMode: 'potential' | 'current'
  exportTaxRate: number
  showSuggestions?: boolean
  showWarnings?: boolean
  onConfigChange: (input: {
    planetId: number
    surplusForSale?: boolean
  }) => Promise<void>
}

export function PlanetDetailModal({
  colony,
  open,
  onOpenChange,
  rateMode,
  exportTaxRate,
  showSuggestions = true,
  showWarnings = true,
  onConfigChange,
}: Props) {
  const { t } = useTranslations()
  const [saving, setSaving] = useState(false)

  if (!colony) return null

  const netIsk =
    rateMode === 'potential' ? colony.potentialNetIskPerHour : colony.currentNetIskPerHour
  const exportRevenue = colonyExportRevenuePerHour(colony, rateMode)
  const importCost = colonyImportCostPerHour(colony, rateMode)
  const exportTax = colonyExportTaxPerHour(colony, rateMode)
  const unroutedValuation = hasUnroutedProductionValuation(colony, rateMode)
  const hasWarnings = colony.warnings.length > 0 || colony.isStale || unroutedValuation

  const updateConfig = async (patch: { surplusForSale?: boolean }) => {
    setSaving(true)
    try {
      await onConfigChange({
        planetId: colony.planetId,
        surplusForSale: patch.surplusForSale ?? colony.config.surplusForSale,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto border-zinc-800 bg-zinc-950">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3 text-left">
            <PiPlanetIcon planetType={colony.planetType} label={colony.planetTypeLabel} size={40} />
            <div>
              <span className="text-lg text-eve-text">
                {colony.planetTypeLabel} — {colony.planetName ?? colony.solarSystemName}
              </span>
              <p className="text-xs text-zinc-500">
                {colony.characterName} · {t('pi.planet.upgrade')} {colony.upgradeLevel} ·{' '}
                {colony.numPins} {t('pi.planet.pins')}
              </p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                {t('pi.planet.netIskPerHour')}
              </p>
              <p className={cn("text-xl font-bold tabular-nums", netIsk >= 0 ? "text-emerald-300" : "text-red-400")}>
                {formatCurrencyValue(netIsk)}
                <span className="ml-1 text-sm font-normal text-zinc-500">/h</span>
              </p>
              {Math.round(colony.potentialNetIskPerHour) !== Math.round(colony.currentNetIskPerHour) ? (
                <p className="text-[10px] text-cyan-300/80">
                  {t('pi.summary.potentialAside', {
                    value: formatCurrencyValue(colony.potentialNetIskPerHour),
                  })}
                </p>
              ) : null}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {colony.colonyRole && colony.colonyRole !== 'unknown' ? (
            <ColonyRoleBadge role={colony.colonyRole} showFlow />
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <StaleDataBadge colony={colony} className="px-2 py-0.5 text-[10px]" />
            {colony.extractors.some((e) => e.isExpired) ? (
              <span className="rounded bg-red-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-red-300">
                {t('pi.planet.expiredExtractor')}
              </span>
            ) : null}
            {colony.warnings.length > 0 ? (
              <span className="rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-300">
                {colony.warnings.length} {t('pi.warnings.title')}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-zinc-400">
              {t('pi.planet.entry')}:{' '}
              <span className="text-zinc-200">
                {colony.entryName ?? '—'}
                {colony.entryTier != null ? ` (P${colony.entryTier})` : ''}
              </span>
            </span>
            <span className="text-zinc-400">
              {t('pi.planet.exit')}:{' '}
              <span className="text-emerald-300">
                {colony.exitName ?? '—'}
                {colony.exitTier != null ? ` (P${colony.exitTier})` : ''}
              </span>
            </span>
            {colony.exitUnitPrice > 0 ? (
              <span className="text-zinc-400">
                {t('pi.planet.exitPrice')}:{' '}
                <span className="text-emerald-300">{formatCurrencyValue(colony.exitUnitPrice)}</span>
              </span>
            ) : null}
          </div>

          {colony.lastUpdate ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
              <span>
                {t('pi.planet.lastUpdate')}: {new Date(colony.lastUpdate).toLocaleString()}
                {colony.isStale ? ` · ${t('pi.planet.refreshInGame')}` : null}
              </span>
              <ProjectionSeal colony={colony} />
            </div>
          ) : null}

          {/* 1. Status & action — what's wrong and what to do */}
          {showWarnings && hasWarnings ? (
            <PiCollapsiblePanel
              tone="amber"
              title={t('pi.warnings.title')}
              icon={<AlertTriangle className="h-3.5 w-3.5" />}
              count={colony.warnings.length}
              defaultOpen
            >
              <ul className="list-inside list-disc space-y-0.5 text-amber-100/80">
                {colony.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </PiCollapsiblePanel>
          ) : null}

          {showWarnings && unroutedValuation ? (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
              {t('pi.warnings.unroutedProduction')}
            </div>
          ) : null}

          {showSuggestions &&
          colony.sourcingSuggestions &&
          colony.sourcingSuggestions.length > 0 ? (
            <PiCollapsiblePanel
              tone="emerald"
              title={`💡 ${t('pi.suggestions.title')}`}
              count={colony.sourcingSuggestions.length}
            >
              <ul className="list-inside list-disc space-y-0.5 text-emerald-100/80">
                {colony.sourcingSuggestions.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </PiCollapsiblePanel>
          ) : null}

          <div className="flex flex-wrap items-center gap-6 rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <div className="flex items-center gap-2">
              <Switch
                id={`surplus-modal-${colony.planetId}`}
                checked={colony.config.surplusForSale}
                disabled={saving}
                onCheckedChange={(checked) => void updateConfig({ surplusForSale: checked })}
              />
              <Label htmlFor={`surplus-modal-${colony.planetId}`} className="text-xs text-zinc-300">
                {t('pi.config.surplusForSale')}
              </Label>
            </div>
          </div>

          {/* 2. P&L */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-violet-300">
              {t('pi.financial.localBreakdown')}
            </p>
            <PiFinancialBreakdown
              exportRevenue={exportRevenue}
              importCost={importCost}
              exportTaxRate={exportTaxRate}
              exportTax={exportTax}
              compact
            />
          </div>

          {/* 3. Storage & launchpads — the most operationally useful panel */}
          <PinBufferStatusList colony={colony} rateMode={rateMode} />

          {/* Extractors (operational: resurvey timing / ISK) */}
          {colony.extractors.length > 0 ? (
            <section className="space-y-2">
              <h4 className="font-mono text-xs font-bold uppercase tracking-wider text-violet-300">
                {t('pi.extractors.title')}
              </h4>
              <div className="overflow-x-auto rounded-lg border border-zinc-800">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-zinc-950/80 text-[10px] uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="px-3 py-2">{t('pi.extractors.product')}</th>
                      <th className="px-3 py-2">{t('pi.extractors.designed')}</th>
                      <th className="px-3 py-2">{t('pi.extractors.current')}</th>
                      <th className="px-3 py-2">{t('pi.extractors.expires')}</th>
                      <th className="px-3 py-2">{t('pi.extractors.resurveyIsk')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {colony.extractors.map((ext) => (
                      <tr key={ext.pinId} className="border-t border-zinc-800/80">
                        <td className="px-3 py-2 text-zinc-200">{ext.productName}</td>
                        <td className="px-3 py-2 tabular-nums text-zinc-300">
                          {formatPiRate(ext.designedUnitsPerHour)}/h
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2 tabular-nums',
                            ext.isExpired ? 'text-red-300' : 'text-zinc-300'
                          )}
                        >
                          {formatPiRate(ext.currentUnitsPerHour)}/h
                        </td>
                        <td className="px-3 py-2 text-zinc-400">
                          {ext.expiryTime
                            ? new Date(ext.expiryTime).toLocaleString()
                            : '—'}
                          {ext.isExpired ? ` (${t('pi.planet.expiredExtractor')})` : null}
                        </td>
                        <td
                          className={cn(
                            'px-3 py-2 tabular-nums',
                            (ext.resurveyIskPerHour ?? 0) > 0 ? 'text-emerald-300' : 'text-zinc-500'
                          )}
                        >
                          {ext.resurveyIskPerHour != null && ext.resurveyIskPerHour > 0
                            ? formatCurrencyValue(ext.resurveyIskPerHour)
                            : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {/* 4. Grid CPU/PG */}
          {colony.grid ? <PiGridPanel grid={colony.grid} /> : null}

          {/* 5. Recipes */}
          <RecipeList colony={colony} rateMode={rateMode} />

          {/* Commodity balance — Level 3, collapsed by default */}
          <BalanceTable colony={colony} rateMode={rateMode} defaultOpen={false} />

          {/* 6. Production graph — Level 3, collapsed by default */}
          <ProductionChainView colony={colony} rateMode={rateMode} defaultOpen={false} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
