'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Cpu,
  Save,
  FileCode2,
  ClipboardCopy,
  Globe,
  Lock,
  Loader2,
  Plus,
  X,
  Zap,
  AlertTriangle,
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
import { SlotRacks } from '@/components/fits/SlotRacks'
import { ModuleBrowserPanel } from '@/components/fits/ModuleBrowserPanel'
import { ShipAttributesPanel } from '@/components/fits/attributes'
import { ModifierBreakdown } from '@/components/fits/ModifierBreakdown'
import { ChargeSelector } from '@/components/fits/context-menu/ChargeSelector'
import { FitParser } from '@/lib/fits/fit-parser'
import { cn } from '@/lib/utils'
import { useFitEditorV2 } from '@/components/fits-v2/hooks/useFitEditorV2'
import { useTranslations } from '@/i18n/hooks'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

function ResourceMeter({
  label,
  used,
  total,
  percent,
  valueClass,
  barClass,
  history,
  historyKey,
}: {
  label: string
  used?: number
  total?: number
  percent: number
  valueClass?: string
  barClass?: string
  history?: Record<string, { base: number; final: number; modifiers: unknown[] }>
  historyKey?: string
}) {
  const clamped = Math.min(100, Math.max(0, percent))
  const over = percent > 100
  const inner = (
    <div className="flex-1 rounded-lg border border-border/80 bg-card/80 px-3 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        <span className={cn('font-mono text-xs tabular-nums', valueClass ?? 'text-foreground')}>
          {percent.toFixed(0)}%
        </span>
      </div>
      {used != null && total != null && (
        <p className="mt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
          {used.toFixed(1)} / {total.toFixed(1)}
        </p>
      )}
      <div className="mt-1.5 h-1.5 rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', over ? 'bg-destructive' : barClass ?? 'bg-primary')}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  )

  if (history && historyKey && history[historyKey]) {
    return (
      <TooltipProvider>
        <Tooltip delayDuration={120}>
          <TooltipTrigger asChild>{inner}</TooltipTrigger>
          <TooltipContent side="bottom" className="border-none bg-transparent p-0">
            <ModifierBreakdown history={history as never} historyKey={historyKey} />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }
  return inner
}

function FitEditorView() {
  const { t } = useTranslations()
  const editor = useFitEditorV2()
  const isCapStable = editor.stats?.capacitor?.stable !== false
  const cpuUsage = editor.stats?.cpu
  const powerUsage = editor.stats?.power
  const calUsage = editor.stats?.calibration
  const capPercent = editor.stats?.capacitor?.percent ?? 100
  const resourceHistory = editor.stats?.slotHistory || editor.stats?.history
  const cpuPercent = cpuUsage?.percent ?? (cpuUsage && cpuUsage.total > 0 ? (cpuUsage.used / cpuUsage.total) * 100 : 0)
  const powerPercent = powerUsage?.percent ?? (powerUsage && powerUsage.total > 0 ? (powerUsage.used / powerUsage.total) * 100 : 0)
  const calPercent = calUsage?.percent ?? (calUsage && calUsage.total > 0 ? (calUsage.used / calUsage.total) * 100 : 0)

  const handleCopyEft = async () => {
    if (!editor.fit.shipId) {
      toast.error(t('fits.editor.copyEftEmpty'))
      return
    }
    const eft = FitParser.toEFT({
      ship: editor.fit.ship || '',
      shipId: editor.fit.shipId || 0,
      name: editor.fit.name,
      modules: editor.fit.modules,
      drones: editor.fit.drones,
      cargo: editor.fit.cargo,
    })
    try {
      await navigator.clipboard.writeText(eft)
      toast.success(t('fits.editor.copyEftDone'))
    } catch {
      toast.error('Clipboard unavailable')
    }
  }

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
            onClick={handleCopyEft}
          >
            <ClipboardCopy className="h-4 w-4" />
            <span className="hidden sm:inline">{t('fits.editor.copyEft')}</span>
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
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-3 py-3 md:px-5">
            {/* Resource strip: CPU / Power Grid / Capacitor / Calibration */}
            <div className="flex w-full flex-wrap gap-2">
              <ResourceMeter
                label={t('fits.rackLabels.cpuUse')}
                used={cpuUsage?.used}
                total={cpuUsage?.total}
                percent={cpuPercent}
                history={resourceHistory as never}
                historyKey="CPU"
              />
              <ResourceMeter
                label={t('fits.rackLabels.powerGridUse')}
                used={powerUsage?.used}
                total={powerUsage?.total}
                percent={powerPercent}
                history={resourceHistory as never}
                historyKey="Powergrid"
              />
              <ResourceMeter
                label="Capacitor"
                percent={capPercent}
                valueClass={isCapStable ? 'text-emerald-500' : 'text-destructive'}
                barClass={isCapStable ? 'bg-emerald-500' : 'bg-destructive'}
              />
              <ResourceMeter
                label={t('fits.editor.calibration')}
                used={calUsage?.used}
                total={calUsage?.total}
                percent={calPercent}
              />
            </div>

            {/* Pyfa-style vertical slot racks */}
            <div className="w-full rounded-xl border border-border/80 bg-card/60 p-3 backdrop-blur-md sm:p-4">
              {editor.fit.shipId ? (
                <SlotRacks
                  slots={{
                    high: editor.stats?.slots?.high?.total || 0,
                    med: editor.stats?.slots?.med?.total || 0,
                    low: editor.stats?.slots?.low?.total || 0,
                    rig: editor.stats?.slots?.rig?.total || 0,
                    subsystem: (editor.stats?.slots as { subsystem?: { total: number } })?.subsystem?.total || 0,
                  }}
                  fittedModules={editor.fit.modules || []}
                  drones={editor.fit.drones || []}
                  cargo={editor.fit.cargo || []}
                  onModuleAdd={editor.handleModuleAdd}
                  onModuleRemove={editor.handleUnfitModule}
                  onModuleRightClick={editor.handleModuleRightClick}
                  onModuleDrop={editor.handleModuleDrop}
                  onRemoveDrone={editor.handleRemoveDrone}
                  onRemoveCargo={editor.handleRemoveCargo}
                  highlightedSection={editor.highlightedSection}
                  slotErrors={editor.stats?.validation?.slotErrors}
                  compatibilityMap={editor.compatibilityMap}
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                  <p className="text-sm font-medium text-foreground">{editor.fit.ship || 'Select a ship'}</p>
                  <p className="max-w-xs text-xs text-muted-foreground">{t('fits.rackLabels.addModuleHint')}</p>
                  <Button variant="outline" size="sm" onClick={() => editor.setShipSelectorOpen(true)}>
                    {t('fits.moduleBrowser.openShipSelector')}
                  </Button>
                </div>
              )}
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
              moduleTypeIds={editor.fit.modules?.map((m) => m.typeId) || []}
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
          moduleTypeIds={editor.fit.modules?.map((m) => m.typeId) || []}
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
