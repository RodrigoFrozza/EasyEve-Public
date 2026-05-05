'use client'

import { useMemo, useState } from 'react'
import {
  useAdminPlatformModules,
  useUpdatePlatformModule,
} from '@/lib/admin/hooks/useAdminModulePrices'
import type { PlatformModuleRecord } from '@/lib/admin/hooks/useAdminModulePrices'
import {
  platformModuleTitle,
  platformModuleDescription,
} from '@/lib/admin/platform-module-meta'
import { AdminBadge } from '@/components/admin/shared/AdminBadge'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  Layers,
  Crosshair,
  Mountain,
  ShoppingCart,
  Shapes,
  Orbit,
  Compass,
  MapPin,
  Crown,
  Swords,
  type LucideIcon,
  LayoutGrid,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const MODULE_ICONS: Record<string, LucideIcon> = {
  fits: Shapes,
  market: ShoppingCart,
  mining: Mountain,
  ratting: Crosshair,
  abyssal: Orbit,
  exploration: Compass,
  escalations: MapPin,
  crab: Crown,
  pvp: Swords,
}

function ModuleGlyph({ moduleId }: { moduleId: string }) {
  const Icon = MODULE_ICONS[moduleId.toLowerCase()] ?? Layers
  return <Icon className="h-5 w-5 shrink-0 text-eve-accent" aria-hidden />
}

export function PlatformModulesManagerV2() {
  const { data, isLoading } = useAdminPlatformModules()
  const updateMutation = useUpdatePlatformModule()
  const [pendingId, setPendingId] = useState<string | null>(null)
  /** Row id → toggled value while the request is in flight */
  const [optimisticById, setOptimisticById] = useState<Record<string, boolean>>({})

  const modules = useMemo(() => data?.modules ?? [], [data])

  const stats = useMemo(() => {
    const active = modules.filter((m) =>
      m.id in optimisticById ? optimisticById[m.id] : m.isActive
    ).length
    return { total: modules.length, active }
  }, [modules, optimisticById])

  const effectiveActive = (row: PlatformModuleRecord) =>
    row.id in optimisticById ? optimisticById[row.id] : row.isActive

  const handleToggle = async (row: PlatformModuleRecord, next: boolean) => {
    if (next === effectiveActive(row)) return
    setPendingId(row.id)
    setOptimisticById((prev) => ({ ...prev, [row.id]: next }))
    try {
      await updateMutation.mutateAsync({
        module: row.module,
        isActive: next,
      })
      toast.success(next ? 'Module enabled' : 'Module disabled')
    } catch {
      toast.error('Could not update module')
    } finally {
      setPendingId(null)
      setOptimisticById((prev) => {
        const { [row.id]: _, ...rest } = prev
        return rest
      })
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="h-44 animate-pulse rounded-xl border border-eve-border/20 bg-eve-panel/50"
          />
        ))}
      </div>
    )
  }

  if (modules.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-eve-border/40 bg-eve-panel/30 px-6 py-16 text-center">
        <LayoutGrid className="mx-auto mb-3 h-10 w-10 text-eve-text/25" />
        <p className="text-sm font-medium text-eve-text">No modules registered</p>
        <p className="mt-1 text-xs text-eve-text/50">
          Module rows are created by migrations or repair scripts. Contact engineering if this list
          should not be empty.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <Card className="border-eve-border/30 bg-eve-panel/40">
          <CardContent className="flex items-center justify-between gap-3 pt-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-eve-text/40">
                Registered
              </p>
              <p className="text-2xl font-bold tabular-nums text-eve-text">{stats.total}</p>
            </div>
            <LayoutGrid className="h-9 w-9 text-eve-accent/40" />
          </CardContent>
        </Card>
        <Card className="border-eve-border/30 bg-eve-panel/40">
          <CardContent className="flex items-center justify-between gap-3 pt-6">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-eve-text/40">
                Globally active
              </p>
              <p className="text-2xl font-bold tabular-nums text-green-400">{stats.active}</p>
            </div>
            <div className="rounded-full bg-green-500/15 px-3 py-1 text-[10px] font-black uppercase text-green-400">
              Live
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((row) => {
          const title = platformModuleTitle(row.module)
          const description = platformModuleDescription(row.module)
          const busy = pendingId === row.id && updateMutation.isPending

          return (
            <Card
              key={row.id}
              className={cn(
                'border-eve-border/30 bg-eve-panel/50 transition-colors hover:border-eve-accent/25',
                !effectiveActive(row) && 'opacity-75'
              )}
            >
              <CardHeader className="space-y-0 pb-2">
                <CardTitle className="flex items-start justify-between gap-3 text-base font-bold">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-eve-border/30 bg-eve-background/40">
                      <ModuleGlyph moduleId={row.module} />
                    </span>
                    <div className="min-w-0">
                      <span className="block truncate">{title}</span>
                      <span className="mt-0.5 block font-mono text-[10px] font-normal uppercase tracking-wide text-eve-text/35">
                        {row.module}
                      </span>
                    </div>
                  </div>
                  <AdminBadge status={effectiveActive(row) ? 'success' : 'error'}>
                    {effectiveActive(row) ? 'On' : 'Off'}
                  </AdminBadge>
                </CardTitle>
              </CardHeader>
              <CardContent className="pb-3">
                <p className="line-clamp-3 text-sm leading-relaxed text-eve-text/60">
                  {description}
                </p>
              </CardContent>
              <CardFooter className="flex flex-wrap items-center justify-between gap-3 border-t border-eve-border/20 pt-4">
                <span className="text-[11px] text-eve-text/45">
                  Updated {new Date(row.updatedAt).toLocaleString()}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-eve-text/40">
                    Global
                  </span>
                  <Switch
                    checked={effectiveActive(row)}
                    disabled={busy}
                    onCheckedChange={(checked) => void handleToggle(row, checked)}
                    aria-label={`Toggle ${title}`}
                  />
                </div>
              </CardFooter>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

/** @deprecated Prefer `PlatformModulesManagerV2` */
export const ModulePricesManagerV2 = PlatformModulesManagerV2
