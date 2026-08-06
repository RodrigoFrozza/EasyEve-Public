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
import { AdminMetricCard } from '@/components/admin/shared/AdminMetricCard'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'
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
  AlertTriangle,
  Globe,
  type LucideIcon,
  LayoutGrid,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

const MODULE_ICONS: Record<string, LucideIcon> = {
  fits: Shapes,
  market: ShoppingCart,
  pi: Globe,
  mining: Mountain,
  ratting: Crosshair,
  abyssal: Orbit,
  exploration: Compass,
  escalations: AlertTriangle,
  crab: Crown,
  pvp: Swords,
}

function ModuleGlyph({ moduleId }: { moduleId: string }) {
  const Icon = MODULE_ICONS[moduleId.toLowerCase()] ?? Layers
  return <Icon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
}

export function PlatformModulesManagerV2() {
  const { t } = useTranslations()
  const { data, isLoading } = useAdminPlatformModules()
  const updateMutation = useUpdatePlatformModule()
  const [pendingId, setPendingId] = useState<string | null>(null)
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
      toast.success(
        next ? t('admin.modules.enabled') : t('admin.modules.disabled')
      )
    } catch {
      toast.error(t('admin.modules.toggleError'))
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
          <Skeleton key={i} className="h-36 rounded-lg" />
        ))}
      </div>
    )
  }

  if (modules.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
        <LayoutGrid className="mx-auto mb-3 h-10 w-10 opacity-40" />
        {t('admin.modules.empty')}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 max-w-lg">
        <AdminMetricCard
          title={t('admin.modules.total')}
          value={String(stats.total)}
          icon={LayoutGrid}
          color="blue"
        />
        <AdminMetricCard
          title={t('admin.modules.active')}
          value={String(stats.active)}
          icon={Layers}
          color="green"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {modules.map((row) => {
          const title = platformModuleTitle(row.module)
          const description = platformModuleDescription(row.module)
          const busy = pendingId === row.id && updateMutation.isPending
          const active = effectiveActive(row)

          return (
            <div
              key={row.id}
              className={cn(
                'rounded-lg border border-border bg-card p-4 transition-colors',
                !active && 'opacity-75'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="rounded-md bg-primary/10 p-2.5">
                    <ModuleGlyph moduleId={row.module} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground truncate">
                      {title}
                    </h3>
                    <p className="text-xs text-muted-foreground capitalize">
                      {row.module}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    'text-xs font-medium shrink-0',
                    active ? 'text-emerald-600' : 'text-muted-foreground'
                  )}
                >
                  {active ? t('admin.filterActive') : t('admin.modules.inactive')}
                </span>
              </div>

              <p className="mt-3 text-xs text-muted-foreground line-clamp-2 min-h-[2.5rem]">
                {description || t('admin.modules.noDescription')}
              </p>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <span className="text-xs text-muted-foreground">
                  {t('admin.modules.updated')}:{' '}
                  {new Date(row.updatedAt).toLocaleString()}
                </span>
                <div className="flex items-center gap-2">
                  {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <Switch
                    checked={active}
                    disabled={busy}
                    onCheckedChange={(checked) => void handleToggle(row, checked)}
                    aria-label={`${title} ${active ? 'on' : 'off'}`}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export const ModulePricesManagerV2 = PlatformModulesManagerV2
