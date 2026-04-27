'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { ShipStats } from '@/types/fit'
import { useTranslations } from '@/i18n/hooks'
import { 
  Battery, 
  Sword, 
  Shield, 
  Crosshair, 
  Navigation, 
  DollarSign,
  ShoppingCart,
  AlertTriangle,
  Loader2
} from 'lucide-react'
import { 
  ViewModeToggle, 
  ViewMode, 
  AttributeBar, 
  ResistanceBars, 
  AttributeCategory 
} from './index'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { ModifierBreakdown } from '../ModifierBreakdown'

interface ShipAttributesPanelProps {
  stats: ShipStats | null
  shipName: string
  shipId: number
  calculating?: boolean
  moduleCount?: number
  className?: string
  history?: Record<string, any>
}

interface PricingData {
  ship: number
  fit: number
  loading?: boolean
}

export const ShipAttributesPanel: React.FC<ShipAttributesPanelProps> = ({
  stats,
  shipName,
  shipId,
  calculating = false,
  moduleCount = 0,
  className,
  history
}) => {
  const { t } = useTranslations()
  const [viewMode, setViewMode] = useState<ViewMode>('barPercent')
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    pricing: true
  })
  const [pricing, setPricing] = useState<PricingData>({ ship: 0, fit: 0 })

  const handleToggleSection = useCallback((id: string, collapsed: boolean) => {
    setCollapsedSections(prev => ({ ...prev, [id]: collapsed }))
  }, [])

  const fetchPricing = useCallback(async () => {
    if (!stats || moduleCount === 0) return
    
    setPricing(prev => ({ ...prev, loading: true }))
    
    try {
      const typeIds = [shipId]
      
      const res = await fetch('/api/market/prices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type_ids: typeIds })
      })
      
      if (res.ok) {
        const data = await res.json()
        const prices = data.prices || {}
        const shipPrice = prices[shipId] || 0
        
        setPricing({
          ship: shipPrice,
          fit: shipPrice + (moduleCount * 1000000)
        })
      }
    } catch (err) {
      console.error('Failed to fetch pricing', err)
    } finally {
      setPricing(prev => ({ ...prev, loading: false }))
    }
  }, [stats, shipId, moduleCount])

  const formatIsk = (value: number): string => {
    if (value >= 1000000000) return `${(value / 1000000000).toFixed(2)}B`
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(0)}K`
    return value.toFixed(0)
  }

  const formatCompactNumber = (value: number): string => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
    return value.toFixed(0)
  }

  const safeNumber = (value: unknown, fallback = 0): number => {
    const n = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(n) ? n : fallback
  }

  const resistanceData = useMemo(() => {
    if (!stats?.resistance) return []
    
    return [
      {
        layer: 'shield' as const,
        em: stats.resistance.shield.em,
        explosive: stats.resistance.shield.exp,
        kinetic: stats.resistance.shield.kin,
        thermal: stats.resistance.shield.therm,
        ehp: stats.ehp?.shield || 0
      },
      {
        layer: 'armor' as const,
        em: stats.resistance.armor.em,
        explosive: stats.resistance.armor.exp,
        kinetic: stats.resistance.armor.kin,
        thermal: stats.resistance.armor.therm,
        ehp: stats.ehp?.armor || 0
      },
      {
        layer: 'hull' as const,
        em: stats.resistance.hull.em,
        explosive: stats.resistance.hull.exp,
        kinetic: stats.resistance.hull.kin,
        thermal: stats.resistance.hull.therm,
        ehp: stats.ehp?.hull || 0
      }
    ]
  }, [stats])

  return (
    <div className={cn("flex h-full min-h-0 flex-col bg-card/25", className)}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:px-5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tracking-tight text-foreground">
              Ship stats
            </span>
            {calculating && (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            Live dogma snapshot
          </span>
        </div>

        <ViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>

      {/* VALIDATION & WARNINGS */}
      {stats?.validation && (stats.validation.errors.length > 0 || stats.validation.warnings.length > 0) && (
        <div className="space-y-1.5 border-b border-border bg-muted/20 px-4 py-2.5 md:px-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className={cn(
              "h-4 w-4 shrink-0",
              stats.validation.errors.length > 0 ? "text-destructive" : "text-amber-600"
            )} />
            <span className="text-xs font-semibold text-foreground">
              Validation
            </span>
          </div>

          <div className="space-y-1.5">
            {stats.validation.errors.map((error, idx) => (
              <motion.div
                key={`error-${idx}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-2 rounded-md border border-destructive/25 bg-destructive/10 px-2.5 py-2"
              >
                <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                <span className="text-xs font-medium leading-snug text-destructive">
                  {error.replace(/_/g, ' ')}
                </span>
              </motion.div>
            ))}
            {stats.validation.warnings.map((warning, idx) => (
              <motion.div
                key={`warning-${idx}`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2"
              >
                <div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-600" />
                <span className="text-xs font-medium leading-snug text-amber-800 dark:text-amber-200">
                  {warning.replace(/_/g, ' ')}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Scrollable Content */}
      <div className="custom-scrollbar min-h-0 flex-1 overflow-x-hidden overflow-y-auto scroll-smooth pb-20">
        {/* CAPACITOR */}
        <AttributeCategory
          id="capacitor"
          label="Capacitor"
          icon={Battery}
          collapsed={collapsedSections.capacitor}
          onToggle={handleToggleSection}
        >
          {stats?.capacitor ? (
            <div className="space-y-2 pt-1">
              <AttributeBar
                label="Total Capacity"
                value={stats.capacitor.capacity}
                unit="GJ"
                type="number"
                viewMode={viewMode}
                color="blue"
                history={stats.history}
                historyKey="Capacitor"
              />
              <AttributeBar
                label="Recharge Time"
                value={stats.capacitor.rechargeRate}
                unit="s"
                type="time"
                viewMode={viewMode}
                color="blue"
                history={stats.history}
                historyKey="Capacitor Recharge"
              />
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Status</p>
                  <p className={cn(
                    "text-sm font-semibold",
                    stats.capacitor.stable ? "text-emerald-500" : "text-destructive"
                  )}>
                    {stats.capacitor.stable ? 'Stable' : 'Critical'}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Net drain</p>
                  <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                    {stats.capacitor.usePerSecond?.toFixed(1) || '0.0'}/s
                  </p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Cap level</p>
                  <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                    {stats.capacitor.percent?.toFixed(1) || '100.0'}%
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-2 text-xs italic text-muted-foreground">{t('global.noCapacitorData')}</div>
          )}
        </AttributeCategory>

        {/* OFFENSIVE */}
        <AttributeCategory
          id="offensive"
          label="Firepower"
          icon={Sword}
          collapsed={collapsedSections.offensive}
          onToggle={handleToggleSection}
        >
          {stats?.dps ? (
            <div className="space-y-2 pt-1">
              <TooltipProvider>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <div className="flex cursor-help items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2.5">
                      <span className="text-xs font-medium text-muted-foreground">Total DPS</span>
                      <span className="font-mono text-xl font-semibold tabular-nums text-foreground">
                        {safeNumber(stats.dps.total).toFixed(1)}
                      </span>
                    </div>
                  </TooltipTrigger>
                  {stats.history?.['Total DPS'] && (
                    <TooltipContent side="right" className="p-0 border-none bg-transparent">
                      <ModifierBreakdown 
                        label="Total DPS"
                        base={stats.history['Total DPS'].base}
                        final={stats.history['Total DPS'].final}
                        modifiers={stats.history['Total DPS'].modifiers}
                        unit=" DPS"
                      />
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: 'Turret', value: stats.dps.turret, color: 'text-red-600 dark:text-red-400' },
                  { label: 'Missile', value: stats.dps.missile, color: 'text-blue-600 dark:text-blue-400' },
                  { label: 'Drone', value: stats.dps.drone, color: 'text-emerald-600 dark:text-emerald-400' }
                ].map(type => (
                  <div
                    key={type.label}
                    className="flex flex-col rounded-md border border-border bg-muted/20 px-2.5 py-2"
                  >
                    <span className="mb-0.5 text-[10px] font-medium text-muted-foreground">{type.label}</span>
                    <span className={cn("font-mono text-sm font-semibold tabular-nums", type.color)}>
                      {type.value?.toFixed(1) || '0.0'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="py-2 text-xs italic text-muted-foreground">No DPS data</div>
          )}
        </AttributeCategory>

        {/* TANK */}
        <AttributeCategory
          id="tank"
          label="Defense"
          icon={Shield}
          collapsed={collapsedSections.tank}
          onToggle={handleToggleSection}
        >
          {stats?.ehp ? (
            <div className="space-y-3 pt-1">
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <TooltipProvider>
                  <Tooltip delayDuration={100}>
                    <TooltipTrigger asChild>
                      <div className="mb-2.5 flex cursor-help items-center justify-between gap-2">
                        <span className="text-xs font-medium text-muted-foreground">Total EHP</span>
                        <div className="flex items-baseline gap-2">
                          <span className="font-mono text-xl font-semibold tabular-nums text-foreground">
                            {formatCompactNumber(stats.ehp.total)}
                          </span>
                        </div>
                      </div>
                    </TooltipTrigger>
                    {stats.history?.['Effective HP'] && (
                      <TooltipContent side="right" className="p-0 border-none bg-transparent">
                        <ModifierBreakdown 
                          label="Effective HP"
                          base={stats.history['Effective HP'].base}
                          final={stats.history['Effective HP'].final}
                          modifiers={stats.history['Effective HP'].modifiers}
                        />
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
                <div className="mb-3 flex h-2 gap-0.5 overflow-hidden rounded-full border border-border bg-muted p-px">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(stats.ehp.shield / stats.ehp.total) * 100}%` }}
                    className="h-full rounded-l-full bg-blue-500/90"
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(stats.ehp.armor / stats.ehp.total) * 100}%` }}
                    className="h-full bg-amber-500/90"
                  />
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(stats.ehp.hull / stats.ehp.total) * 100}%` }}
                    className="h-full rounded-r-full bg-red-600/90"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Shield', value: stats.ehp.shield, color: 'text-blue-600 dark:text-blue-400' },
                    { label: 'Armor', value: stats.ehp.armor, color: 'text-amber-700 dark:text-amber-400' },
                    { label: 'Hull', value: stats.ehp.hull, color: 'text-red-600 dark:text-red-400' }
                  ].map(hp => (
                    <div key={hp.label} className="flex flex-col items-center rounded-md border border-border/70 bg-background/40 px-2 py-1.5 text-center">
                      <span className="mb-0.5 text-[10px] font-medium text-muted-foreground">{hp.label}</span>
                      <span className={cn("font-mono text-sm font-semibold tabular-nums", hp.color)}>
                        {formatCompactNumber(hp.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <span className="ml-0.5 text-[11px] font-medium text-muted-foreground">Resistances</span>
                <ResistanceBars
                  data={resistanceData}
                  viewMode={viewMode}
                  history={stats.history}
                />
              </div>
            </div>
          ) : (
            <div className="py-2 text-xs italic text-muted-foreground">{t('global.noTankData')}</div>
          )}
        </AttributeCategory>

        {/* FITTING RESOURCES */}
        <AttributeCategory
          id="fitting"
          label="Fitting resources"
          icon={Sword}
          collapsed={collapsedSections.fitting}
          onToggle={handleToggleSection}
        >
          {stats?.powergrid || stats?.cpu ? (
            <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3">
              {stats?.powergrid && (
                <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Power Grid</p>
                  <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-foreground">
                    {safeNumber(stats.powergrid.percent).toFixed(1)}%
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {safeNumber(stats.powergrid.used).toFixed(1)} / {safeNumber(stats.powergrid.total).toFixed(1)}
                  </p>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        stats.powergrid.percent > 100 ? "bg-destructive" : stats.powergrid.percent > 80 ? "bg-amber-500" : "bg-primary"
                      )}
                      style={{ width: `${Math.min(100, Math.max(0, stats.powergrid.percent))}%` }}
                    />
                  </div>
                </div>
              )}
              {stats?.cpu && (
                <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">CPU Output</p>
                  <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-foreground">
                    {safeNumber(stats.cpu.percent).toFixed(1)}%
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {safeNumber(stats.cpu.used).toFixed(1)} / {safeNumber(stats.cpu.total).toFixed(1)}
                  </p>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        stats.cpu.percent > 100 ? "bg-destructive" : stats.cpu.percent > 80 ? "bg-amber-500" : "bg-primary"
                      )}
                      style={{ width: `${Math.min(100, Math.max(0, stats.cpu.percent))}%` }}
                    />
                  </div>
                </div>
              )}
              {stats?.calibration && (
                <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Calibration</p>
                  <p className="mt-0.5 font-mono text-lg font-semibold tabular-nums text-foreground">
                    {safeNumber(stats.calibration.percent).toFixed(1)}%
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {safeNumber(stats.calibration.used).toFixed(1)} / {safeNumber(stats.calibration.total).toFixed(1)}
                  </p>
                  <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        stats.calibration.percent > 100 ? "bg-destructive" : stats.calibration.percent > 80 ? "bg-amber-500" : "bg-primary"
                      )}
                      style={{ width: `${Math.min(100, Math.max(0, stats.calibration.percent))}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="py-2 text-xs italic text-muted-foreground">No fitting data</div>
          )}
        </AttributeCategory>

        {/* TARGETING */}
        <AttributeCategory
          id="targeting"
          label="Targeting"
          icon={Crosshair}
          collapsed={collapsedSections.targeting}
          onToggle={handleToggleSection}
        >
          {stats?.targeting ? (
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between rounded-md border border-border bg-muted/20 px-3 py-2.5">
                <p className="text-xs font-medium text-muted-foreground">Targeting range</p>
                <p className="font-mono text-lg font-semibold tabular-nums text-foreground">
                  {(safeNumber(stats.targeting.range) / 1000).toFixed(1)} km
                </p>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Max locks</p>
                  <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                    {safeNumber(stats.targeting.maxTargets).toFixed(0)}
                  </p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Scan res</p>
                  <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                    {safeNumber(stats.targeting.scanRes).toFixed(0)} mm
                  </p>
                </div>
                <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Signature</p>
                  <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                    {safeNumber(stats.targeting.signature).toFixed(0)} m
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-2 text-xs italic text-muted-foreground">{t('global.noTargetingData')}</div>
          )}
        </AttributeCategory>

        {/* NAVIGATION */}
        <AttributeCategory
          id="navigation"
          label="Navigation"
          icon={Navigation}
          collapsed={collapsedSections.navigation}
          onToggle={handleToggleSection}
        >
          {stats?.velocity ? (
            <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-3">
              <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Max speed</p>
                <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {safeNumber(stats.velocity.maxSpeed).toFixed(1)} m/s
                </p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Align time</p>
                <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {safeNumber(stats.velocity.alignTime).toFixed(2)} s
                </p>
              </div>
              <div className="rounded-md border border-border bg-muted/20 px-2.5 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Warp speed</p>
                <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {safeNumber(stats.velocity.warpSpeed).toFixed(2)} AU/s
                </p>
              </div>
            </div>
          ) : (
            <div className="py-2 text-xs italic text-muted-foreground">{t('global.noNavigationData')}</div>
          )}
        </AttributeCategory>

        {/* PRICING */}
        <AttributeCategory
          id="pricing"
          label="Pricing"
          icon={DollarSign}
          collapsed={collapsedSections.pricing}
          onToggle={handleToggleSection}
        >
          <div className="space-y-2 pt-1">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col rounded-md border border-border bg-muted/20 px-2.5 py-2">
                <span className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Hull estimate</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {pricing.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `${formatIsk(pricing.ship)}`}
                </span>
              </div>
              <div className="flex flex-col rounded-md border border-primary/20 bg-primary/5 px-2.5 py-2">
                <span className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Fit estimate</span>
                <span className="font-mono text-sm font-semibold tabular-nums text-primary">
                  {pricing.loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : `${formatIsk(pricing.fit)}`}
                </span>
              </div>
            </div>
            <Button
              onClick={fetchPricing}
              disabled={pricing.loading || moduleCount === 0}
              className={cn(
                "flex h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-semibold transition-colors",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <ShoppingCart className="w-4 h-4" />
              Refresh estimates
            </Button>
          </div>
        </AttributeCategory>
      </div>
    </div>

  )
}
