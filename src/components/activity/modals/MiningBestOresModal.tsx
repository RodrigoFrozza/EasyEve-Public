'use client'

import { Button } from '@/components/ui/button'
import { useTranslations } from '@/i18n/hooks'
import { cn } from '@/lib/utils'
import { MiningValuableOres } from '../MiningValuableOres'
import { MiningThemedDialog, miningModalTheme } from './mining/MiningThemedDialog'

interface MiningBestOresModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialMiningType?: string
  space?: string
}

export function MiningBestOresModal({
  open,
  onOpenChange,
  initialMiningType,
  space,
}: MiningBestOresModalProps) {
  const { t } = useTranslations()
  const theme = miningModalTheme

  return (
    <MiningThemedDialog
      open={open}
      onOpenChange={onOpenChange}
      badge={t('activity.mining.modals.market.badge')}
      title={t('activity.mining.modals.market.title')}
      description={t('activity.mining.modals.market.description')}
      maxWidth="2xl"
      scrollable
      footer={
        <Button
          type="button"
          variant="ghost"
          onClick={() => onOpenChange(false)}
          className={cn(
            'h-10 w-full rounded-lg border font-mono text-[10px] font-bold uppercase tracking-wide',
            theme.chip
          )}
        >
          {t('activity.mining.modals.common.close')}
        </Button>
      }
    >
      <MiningValuableOres
        initialType={initialMiningType || 'Ore'}
        space={space}
        lockCategory={!!initialMiningType}
        themed
      />
    </MiningThemedDialog>
  )
}
