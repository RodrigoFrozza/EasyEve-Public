'use client'

import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { useAdminFeatureFlags, useUpdateFeatureFlag } from '@/lib/admin/hooks/useAdminFeatureFlags'
import { useTranslations } from '@/i18n/hooks'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'

const FLAG_META: { name: string; labelKey: string; descKey: string }[] = [
  { name: 'autoLootTracking', labelKey: 'admin.operations.flagAutoLoot', descKey: 'admin.operations.flagAutoLootDesc' },
  { name: 'miningLaunchV2', labelKey: 'admin.operations.flagMining', descKey: 'admin.operations.flagMiningDesc' },
  { name: 'abyssalSyncV2', labelKey: 'admin.operations.flagAbyssal', descKey: 'admin.operations.flagAbyssalDesc' },
  { name: 'rattingValidationStrict', labelKey: 'admin.operations.flagRatting', descKey: 'admin.operations.flagRattingDesc' },
  { name: 'explorationQualityGuards', labelKey: 'admin.operations.flagExploration', descKey: 'admin.operations.flagExplorationDesc' },
]

export function FeatureFlagsManager() {
  const { t } = useTranslations()
  const { data: flags, isLoading } = useAdminFeatureFlags()
  const updateFlag = useUpdateFeatureFlag()

  if (isLoading || !flags) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {FLAG_META.map((flag) => (
        <div
          key={flag.name}
          className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4"
        >
          <div className="min-w-0 flex-1">
            <Label htmlFor={flag.name} className="text-sm font-medium">
              {t(flag.labelKey)}
            </Label>
            <p className="mt-0.5 text-xs text-muted-foreground">{t(flag.descKey)}</p>
          </div>
          <Switch
            id={flag.name}
            checked={flags[flag.name] ?? false}
            disabled={updateFlag.isPending}
            onCheckedChange={async (checked) => {
              try {
                await updateFlag.mutateAsync({ name: flag.name, isEnabled: checked })
                toast.success(t('admin.operations.flagUpdated') ?? 'Flag updated')
              } catch {
                toast.error(t('admin.errorPrefix') + (t('admin.operations.flagUpdateError') ?? 'Update failed'))
              }
            }}
          />
        </div>
      ))}
    </div>
  )
}
