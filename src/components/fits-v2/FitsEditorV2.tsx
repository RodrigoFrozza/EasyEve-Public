'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Cpu,
  Save,
  FileCode2,
  Globe,
  Lock,
  Loader2,
  Plus,
  X,
  Zap,
  Keyboard,
  AlertTriangle,
  Bot,
  Package,
  Trash2,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

import { ShipSelector } from '@/components/fits/ShipSelector'
import { CircularSlotVisualizer } from '@/components/fits/CircularSlotVisualizer'
import { ModuleBrowserPanel } from '@/components/fits/ModuleBrowserPanel'
import { ShipAttributesPanel } from '@/components/fits/attributes'
import { ModifierBreakdown } from '@/components/fits/ModifierBreakdown'
import { ChargeSelector } from '@/components/fits/context-menu/ChargeSelector'
import { cn } from '@/lib/utils'
import { useFitEditorV2 } from '@/components/fits-v2/hooks/useFitEditorV2'
import { useTranslations } from '@/i18n/hooks'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

function panelClass() {
  return cn(
    'rounded-xl border border-border/80 bg-card/80 shadow-sm',
    'backdrop-blur-md'
  )
}

function computeRackSize(viewportWidth: number) {
  // Keep the ring large enough that 8 high slots do not overlap (slot buttons ~30–34px).
  if (viewportWidth < 640) return Math.max(300, Math.min(360, viewportWidth - 40))
  if (viewportWidth < 900) return Math.min(440, Math.floor(viewportWidth * 0.48))
  if (viewportWidth < 1280) return Math.min(500, Math.floor(viewportWidth * 0.42))
  return Math.min(560, Math.floor(viewportWidth * 0.36))
}

function FitEditorView() {
  const { t } = useTranslations()
  const editor = useFitEditorV2()
  const [rackSize, setRackSize] = useState(480)
  const isCapStable = editor.stats?.capacitor?.stable !== false
  const cpuUsage = editor.stats?.cpu
  const powerUsage = editor.stats?.power
  const capPercent = editor.stats?.capacitor?.percent ?? 100
  const fittedModules = editor.fit.modules?.length || 0
  const resourceHistory = editor.stats?.slotHistory || editor.stats?.history
  const cpuPercent = cpuUsage?.percent ?? (cpuUsage && cpuUsage.total > 0 ? (cpuUsage.used / cpuUsage.total) * 100 : 0)
  const powerPercent = powerUsage?.percent ?? (powerUsage && powerUsage.total > 0 ? (powerUsage.used / powerUsage.total) * 100 : 0)

  useEffect(() => {
    const onResize = () => setRackSize(computeRackSize(window.innerWidth))
    onResize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  if (editor.loading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 bg-background px-4">
        <div className="relative">
          <div className="h-20 w-20 rounded-full border-2 border-primary/25" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Cpu className="h-8 w-8 animate-pulse text-primary" />
          </div>
        </div>
        <p className="text-sm font-medium text-muted-foreground">Loading fit…</p>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header
        className={cn(
          'z-30 flex shrink-0 items-center justify-between gap-4 border-b border-border px-4 py-2.5 md:px-6',
          'bg-eve-panel/95 backdrop-blur-sm'
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-3 md:gap-5">
          <Link href="/dashboard/fits">
            <Button variant="ghost" size="sm" className="h-9 gap-2 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4 shrink-0" />
              <span className="hidden text-xs font-medium sm:inline">Fits</span>
            </Button>
          </Link>
          <div className="hidden h-6 w-px bg-border sm:block" />
          <Link
            href="/dashboard/fits/editor-v1"
            className="hidden text-xs text-muted-foreground underline-offset-4 hover:text-amber-600 hover:underline sm:inline"
          >
            Legacy editor
          </Link>
          <div className="hidden h-6 w-px bg-border md:block" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <Input
              value={editor.fit.name}
              onChange={(e) => editor.setFit((p) => ({ ...p, name: e.target.value }))}
              className="h-auto min-w-0 border-0 bg-transparent p-0 text-lg font-semibold tracking-tight text-foreground shadow-none focus-visible:ring-0 md:text-xl"
              placeholder="Fit name"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => editor.setShipSelectorOpen(true)}
                className={cn(
                  'inline-flex max-w-[220px] items-center truncate rounded-md border border-border bg-muted/40 px-2 py-0.5 text-left text-xs font-medium',
                  'text-foreground transition-colors hover:bg-muted'
                )}
              >
                {editor.fit.ship || 'Select ship'}
              </button>
              <Badge variant="outline" className="h-5 border-border/70 text-[10px] uppercase tracking-wide text-muted-foreground">
                {editor.id ? 'Saved fit' : 'Unsaved fit'}
              </Badge>
              {editor.incompatibleCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {editor.incompatibleCount} incompatible
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 border-border"
            onClick={() => editor.setImportOpen(true)}
          >
            <FileCode2 className="h-4 w-4" />
            <span className="hidden sm:inline">Import EFT</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-2 border-border"
            onClick={editor.toggleVisibility}
            title={editor.fit.visibility === 'PUBLIC' ? 'Anyone with the link can view' : 'Only you can edit this fit'}
          >
            {editor.fit.visibility === 'PUBLIC' ? (
              <Globe className="h-4 w-4 text-emerald-600" />
            ) : (
              <Lock className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="hidden text-xs font-medium sm:inline">
              {editor.fit.visibility === 'PUBLIC' ? 'Public' : 'Protected'}
            </span>
          </Button>
          <Button
            size="sm"
            className="h-9 gap-2 bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
            onClick={editor.handleSave}
            disabled={editor.saving}
          >
            {editor.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        </div>
      </header>

      {editor.shipDataWarning && (
        <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-900 dark:text-amber-200 md:px-6">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-3.5 w-3.5" />
            Data quality alert:
          </span>{' '}
          {editor.shipDataWarning}
        </div>
      )}

      <main className="relative flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row md:items-stretch">
        <aside
          className={cn(
            'order-2 flex min-h-0 max-h-[min(44vh,28rem)] w-full shrink-0 flex-col border-border bg-muted/15 md:order-1 md:max-h-none md:h-auto md:w-80 md:self-stretch md:border-b-0 md:border-r',
            'border-b'
          )}
        >
          <p className="border-b border-border px-3 py-2 text-[11px] leading-snug text-muted-foreground">
            {t('fits.editor.modulePanelHint')}
          </p>
          <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
            <ModuleBrowserPanel
              className="min-h-0 rounded-none border-0 bg-transparent"
              onModuleSelect={editor.handleItemFit}
              slots={{
                high: editor.stats?.slots?.high?.total || 0,
                med: editor.stats?.slots?.med?.total || 0,
                low: editor.stats?.slots?.low?.total || 0,
                rig: editor.stats?.slots?.rig?.total || 0,
              }}
              shipInfo={{
                id: editor.fit.shipId || 0,
                name: editor.fit.ship || '',
                groupId: editor.stats?.groupId || 0,
                groupName: (editor.stats as { groupName?: string })?.groupName || '',
                rigSize: editor.stats?.rigSize,
              }}
              externalCompatibilityMap={editor.compatibilityMap}
              defaultCollapsed={false}
            />
          </div>
        </aside>

        <section className="relative order-1 flex min-h-0 min-w-0 flex-1 flex-col self-start overflow-y-auto overflow-x-hidden bg-gradient-to-b from-background to-muted/15 md:order-2 md:self-stretch">
          <div className="mx-auto flex w-full max-w-4xl flex-col gap-3 px-3 py-3 md:px-5">
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
              <TooltipProvider>
                <Tooltip delayDuration={120}>
                  <TooltipTrigger asChild>
                    <div className="cursor-help rounded-lg border border-border/80 bg-card/80 p-3">
                      <p className="text-[11px] font-medium text-muted-foreground">CPU</p>
                      <div className="mt-1.5 flex items-end justify-between gap-3">
                        <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                          {cpuPercent.toFixed(1)}%
                        </p>
                        <p className="font-mono text-xs tabular-nums text-muted-foreground">
                          {(cpuUsage?.used ?? 0).toFixed(1)} / {(cpuUsage?.total ?? 0).toFixed(1)}
                        </p>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            cpuPercent > 100 ? 'bg-destructive' : cpuPercent > 80 ? 'bg-amber-500' : 'bg-primary'
                          )}
                          style={{ width: `${Math.min(100, Math.max(0, cpuPercent))}%` }}
                        />
                      </div>
                    </div>
                  </TooltipTrigger>
                  {resourceHistory?.CPU ? (
                    <TooltipContent side="bottom" className="border-none bg-transparent p-0">
                      <ModifierBreakdown history={resourceHistory} historyKey="CPU" />
                    </TooltipContent>
                  ) : null}
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip delayDuration={120}>
                  <TooltipTrigger asChild>
                    <div className="cursor-help rounded-lg border border-border/80 bg-card/80 p-3">
                      <p className="text-[11px] font-medium text-muted-foreground">Power Grid</p>
                      <div className="mt-1.5 flex items-end justify-between gap-3">
                        <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
                          {powerPercent.toFixed(1)}%
                        </p>
                        <p className="font-mono text-xs tabular-nums text-muted-foreground">
                          {(powerUsage?.used ?? 0).toFixed(1)} / {(powerUsage?.total ?? 0).toFixed(1)}
                        </p>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-muted">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            powerPercent > 100 ? 'bg-destructive' : powerPercent > 80 ? 'bg-amber-500' : 'bg-primary'
                          )}
                          style={{ width: `${Math.min(100, Math.max(0, powerPercent))}%` }}
                        />
                      </div>
                    </div>
                  </TooltipTrigger>
                  {resourceHistory?.Powergrid ? (
                    <TooltipContent side="bottom" className="border-none bg-transparent p-0">
                      <ModifierBreakdown history={resourceHistory} historyKey="Powergrid" />
                    </TooltipContent>
                  ) : null}
                </Tooltip>
              </TooltipProvider>

              <div className="rounded-lg border border-border/80 bg-card/80 p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Capacitor</p>
                <div className="mt-1.5 flex items-end justify-between gap-3">
                  <p className={cn('font-mono text-2xl font-semibold tabular-nums', isCapStable ? 'text-emerald-500' : 'text-destructive')}>
                    {capPercent.toFixed(1)}%
                  </p>
                  <p className={cn('text-xs font-medium', isCapStable ? 'text-emerald-500/80' : 'text-destructive/80')}>
                    {isCapStable ? 'Stable' : 'Unstable'}
                  </p>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-muted">
                  <div
                    className={cn('h-full rounded-full transition-all', isCapStable ? 'bg-emerald-500' : 'bg-destructive')}
                    style={{ width: `${Math.min(100, Math.max(0, capPercent))}%` }}
                  />
                </div>
              </div>

              <div className="rounded-lg border border-border/80 bg-card/80 p-3">
                <p className="text-[11px] font-medium text-muted-foreground">Fitted Modules</p>
                <div className="mt-1.5 flex items-end justify-between gap-3">
                  <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">{fittedModules}</p>
                  <p className="text-xs font-medium text-muted-foreground">online</p>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${Math.min(100, Math.max(0, (fittedModules / Math.max(1, (editor.stats?.slots?.high?.total ?? 0) + (editor.stats?.slots?.med?.total ?? 0) + (editor.stats?.slots?.low?.total ?? 0) + (editor.stats?.slots?.rig?.total ?? 0))) * 100))}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex w-full justify-center">
              <div className={cn('relative w-full max-w-[min(100%,36rem)]', panelClass(), 'p-3 sm:p-4 md:p-5')}>
              <div className="flex justify-center overflow-x-hidden">
              <CircularSlotVisualizer
                shipId={editor.fit.shipId || 0}
                shipName={editor.fit.ship || 'Select ship'}
                slots={{
                  high: editor.stats?.slots?.high?.total || 0,
                  med: editor.stats?.slots?.med?.total || 0,
                  low: editor.stats?.slots?.low?.total || 0,
                  rig: editor.stats?.slots?.rig?.total || 0,
                }}
                fittedModules={editor.fit.modules || []}
                cpuUsed={editor.stats?.cpu?.used || 0}
                cpuTotal={editor.stats?.cpu?.total || 0}
                powerUsed={editor.stats?.power?.used || 0}
                powerTotal={editor.stats?.power?.total || 0}
                capacitorStable={editor.stats?.capacitor?.stable !== false}
                capacitorPercent={editor.stats?.capacitor?.percent || 100}
                calculating={editor.calculating}
                size={rackSize}
                slotHistory={editor.stats?.slotHistory}
                slotErrors={editor.stats?.validation?.slotErrors}
                highlightedSection={editor.highlightedSection}
                compatibilityMap={editor.compatibilityMap}
                onModuleRemove={editor.handleUnfitModule}
                onModuleAdd={editor.handleModuleAdd}
                onModuleRightClick={editor.handleModuleRightClick}
                onModuleDrop={editor.handleModuleDrop}
              />
              </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-2 rounded-lg border border-border/80 bg-card/60 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">Slots</span>
                <span className="font-mono tabular-nums text-foreground">
                  H {editor.slotCounts.high}/{editor.stats?.slots?.high?.total ?? 0}
                </span>
                <span className="text-border">·</span>
                <span className="font-mono tabular-nums text-foreground">
                  M {editor.slotCounts.med}/{editor.stats?.slots?.med?.total ?? 0}
                </span>
                <span className="text-border">·</span>
                <span className="font-mono tabular-nums text-foreground">
                  L {editor.slotCounts.low}/{editor.stats?.slots?.low?.total ?? 0}
                </span>
                <span className="text-border">·</span>
                <span className="font-mono tabular-nums text-foreground">
                  R {editor.slotCounts.rig}/{editor.stats?.slots?.rig?.total ?? 0}
                </span>
              </div>
              <div className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground sm:max-w-[14rem] sm:text-right">
                <Keyboard className="mt-0.5 h-3.5 w-3.5 shrink-0 opacity-70" />
                <span>
                  <span className="font-medium text-foreground">Keys:</span> 1–4 high, 5–6 med, 7 low, 8 rig.
                </span>
              </div>
            </div>

            <div className="grid w-full grid-cols-1 gap-2 lg:grid-cols-2">
              <div className="rounded-lg border border-border/80 bg-card/70 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Drone Bay
                    </p>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {(editor.fit.drones || []).length}
                  </span>
                </div>
                {(editor.fit.drones || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No drones loaded.</p>
                ) : (
                  <div className="space-y-1">
                    {(editor.fit.drones || []).map((drone, idx) => (
                      <div
                        key={`${drone.id}-${idx}`}
                        className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-2 py-1.5"
                      >
                        <span className="truncate text-xs text-foreground">{drone.name}</span>
                        <div className="ml-2 flex items-center gap-2">
                          <span className="font-mono text-[11px] text-muted-foreground">x{drone.quantity || 1}</span>
                          <button
                            type="button"
                            onClick={() => editor.handleRemoveDrone(idx)}
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                            aria-label={`Remove drone ${drone.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border/80 bg-card/70 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Cargo
                    </p>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {(editor.fit.cargo || []).length}
                  </span>
                </div>
                {(editor.fit.cargo || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground">No cargo items loaded.</p>
                ) : (
                  <div className="space-y-1">
                    {(editor.fit.cargo || []).map((item, idx) => (
                      <div
                        key={`${item.id}-${idx}`}
                        className="flex items-center justify-between rounded-md border border-border/60 bg-muted/20 px-2 py-1.5"
                      >
                        <span className="truncate text-xs text-foreground">{item.name}</span>
                        <div className="ml-2 flex items-center gap-2">
                          <span className="font-mono text-[11px] text-muted-foreground">x{item.quantity || 1}</span>
                          <button
                            type="button"
                            onClick={() => editor.handleRemoveCargo(idx)}
                            className="rounded p-1 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                            aria-label={`Remove cargo item ${item.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="w-full max-w-md space-y-2 pb-3">
              <div className="flex gap-2 rounded-lg border border-border bg-muted/30 p-1">
                <Input
                  value={editor.newTag}
                  onChange={(e) => editor.setNewTag(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && editor.addTag()}
                  placeholder="Add tag…"
                  className="h-9 border-0 bg-transparent text-sm shadow-none focus-visible:ring-0"
                />
                <Button type="button" onClick={editor.addTag} variant="secondary" size="sm" className="h-9 shrink-0">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <AnimatePresence>
                  {editor.fit.tags?.map((tag) => (
                    <motion.div
                      key={tag}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                    >
                      <Badge
                        variant="secondary"
                        className="gap-1.5 py-1 pl-2.5 pr-1 text-xs font-normal"
                      >
                        {tag}
                        <button
                          type="button"
                          onClick={() => editor.removeTag(tag)}
                          className="rounded p-0.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                          aria-label={`Remove tag ${tag}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </section>

        <aside className="hidden min-h-0 w-[min(22rem,26vw)] shrink-0 self-stretch border-l border-border bg-muted/15 lg:flex lg:flex-col xl:w-96">
          <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar">
            <ShipAttributesPanel
              className="min-h-0 rounded-none border-0 bg-transparent"
              stats={editor.stats}
              shipName={editor.fit.ship || 'No ship'}
              shipId={editor.fit.shipId || 0}
              calculating={editor.calculating}
              moduleCount={editor.fit.modules?.length || 0}
            />
          </div>
        </aside>
      </main>

      <div className="max-h-[min(48vh,26rem)] shrink-0 overflow-y-auto border-t border-border bg-muted/10 lg:hidden custom-scrollbar">
        <div className="sticky top-0 z-10 border-b border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
          Ship stats
        </div>
        <ShipAttributesPanel
          className="rounded-none border-0 bg-transparent"
          stats={editor.stats}
          shipName={editor.fit.ship || 'No ship'}
          shipId={editor.fit.shipId || 0}
          calculating={editor.calculating}
          moduleCount={editor.fit.modules?.length || 0}
        />
      </div>

      <ShipSelector
        open={editor.shipSelectorOpen}
        onOpenChange={editor.setShipSelectorOpen}
        onSelect={editor.handleShipSelect}
      />

      <Dialog open={editor.importOpen} onOpenChange={editor.setImportOpen}>
        <DialogContent className="max-w-lg border-border bg-card sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Import EFT</DialogTitle>
            <DialogDescription>
              Paste a full EFT block. The hull and racks will replace the current fit in the editor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-1">
            <Label htmlFor="eft-import">EFT text</Label>
            <Textarea
              id="eft-import"
              value={editor.eftInput}
              onChange={(e) => editor.setEftInput(e.target.value)}
              placeholder={'[Rifter, Example]\n\nSmall Armor Repairer I\n...'}
              className="min-h-[200px] font-mono text-sm"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => editor.setImportOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={editor.handleImport} disabled={editor.saving || !editor.eftInput.trim()}>
              {editor.saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editor.chargeModalOpen} onOpenChange={editor.setChargeModalOpen}>
        <DialogContent className="max-w-md border-border bg-card p-0 gap-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Charge Selection</DialogTitle>
            <DialogDescription>
              Select ammunition or script for the selected module.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted">
                <Zap className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <div className="text-left text-base font-semibold">
                  {editor.selectedModuleForCharge?.module.name || 'Charge'}
                </div>
                <p className="text-left text-xs text-muted-foreground">Select ammunition or script</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => editor.setChargeModalOpen(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="max-h-[min(420px,60vh)] overflow-y-auto custom-scrollbar p-2">
            {editor.selectedModuleForCharge && (
              <ChargeSelector
                moduleId={Number(
                  editor.selectedModuleForCharge.module.typeId || editor.selectedModuleForCharge.module.id
                )}
                moduleName={editor.selectedModuleForCharge.module.name || ''}
                currentCharge={editor.selectedModuleForCharge.module.charge}
                onSelect={editor.handleChargeSelect}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default function FitsEditorV2() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <FitEditorView />
    </Suspense>
  )
}
