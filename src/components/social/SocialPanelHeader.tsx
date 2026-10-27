'use client'

import { MessageSquare, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/i18n/hooks'

interface SocialPanelHeaderProps {
  onClose: () => void
}

export function SocialPanelHeader({ onClose }: SocialPanelHeaderProps) {
  const { t } = useTranslations()

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-eve-border/60 bg-eve-panel/80 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-sm border border-eve-border bg-eve-dark text-eve-accent">
          <MessageSquare className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-eve-text">{t('social.panelTitle')}</h2>
          <p className="text-xs text-eve-muted">{t('social.panelSubtitle')}</p>
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-eve-muted hover:text-eve-text"
        onClick={onClose}
        aria-label={t('common.close')}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
