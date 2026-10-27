'use client'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { HelpCircle, Play, Target, Users, Zap } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { cn } from '@/lib/utils'

export function NewActivityHelpTooltip() {
  const { t } = useTranslations()

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-10 w-10 rounded-sm bg-eve-panel border border-eve-border/30",
            "hover:bg-eve-dark hover:border-eve-border/50 transition-colors"
          )}
          aria-label="How to start a new activity"
        >
          <span className="text-eve-muted text-lg">?</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-eve-dark border-eve-border text-white max-w-lg p-0 gap-0 rounded-sm">
        <div className="bg-eve-panel p-6 border-b border-eve-border/30">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold text-eve-text flex items-center gap-3">
              <div className="h-8 w-8 rounded-sm bg-eve-dark flex items-center justify-center border border-eve-border/30">
                <HelpCircle className="h-5 w-5 text-eve-muted" />
              </div>
              Getting Started
            </DialogTitle>
            <DialogDescription className="text-[11px] text-eve-muted mt-1">
              How to create and manage activities
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6 bg-eve-dark">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="h-10 w-10 rounded-sm bg-eve-panel border border-eve-border/30 flex items-center justify-center">
                <span className="text-eve-muted font-medium text-sm">01</span>
              </div>
              <div className="w-[1px] h-8 bg-eve-border/30" />
            </div>
            <div className="flex-1 pt-1">
              <h4 className="text-xs font-medium text-white flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-eve-muted/60" />
                {t('activity.helpModal.step1.title')}
              </h4>
              <p className="text-[11px] text-eve-muted leading-relaxed">
                {t('activity.helpModal.step1.description')}
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="h-10 w-10 rounded-sm bg-eve-panel border border-eve-border/30 flex items-center justify-center">
                <span className="text-eve-muted font-medium text-sm">02</span>
              </div>
              <div className="w-[1px] h-8 bg-eve-border/30" />
            </div>
            <div className="flex-1 pt-1">
              <h4 className="text-xs font-medium text-white flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-eve-muted/60" />
                {t('activity.helpModal.step2.title')}
              </h4>
              <p className="text-[11px] text-eve-muted leading-relaxed">
                {t('activity.helpModal.step2.description')}
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="h-10 w-10 rounded-sm bg-eve-panel border border-eve-border/30 flex items-center justify-center">
                <span className="text-eve-muted font-medium text-sm">03</span>
              </div>
              <div className="w-[1px] h-8 bg-eve-border/30" />
            </div>
            <div className="flex-1 pt-1">
              <h4 className="text-xs font-medium text-white flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-eve-muted/60" />
                {t('activity.helpModal.step3.title')}
              </h4>
              <p className="text-[11px] text-eve-muted leading-relaxed">
                {t('activity.helpModal.step3.description')}
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="h-10 w-10 rounded-sm bg-eve-panel border border-eve-border/30 flex items-center justify-center">
                <span className="text-eve-muted font-medium text-sm">04</span>
              </div>
            </div>
            <div className="flex-1 pt-1">
              <h4 className="text-xs font-medium text-white flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-eve-muted/60" />
                {t('activity.helpModal.step4.title')}
              </h4>
              <p className="text-[11px] text-eve-muted leading-relaxed">
                {t('activity.helpModal.step4.description')}
              </p>
            </div>
          </div>

          <div className="bg-eve-panel border border-eve-border/30 rounded-sm p-4 flex items-start gap-3">
            <Play className="h-5 w-5 text-eve-accent shrink-0 mt-0.5" />
            <p className="text-[11px] text-eve-muted leading-relaxed">
              {t('activity.helpModal.tip')}
            </p>
          </div>
        </div>

        <div className="flex justify-end p-4 border-t border-eve-border/30 bg-eve-dark">
          <Button variant="eve" className="h-10 px-6 text-xs">
            {t('activity.helpModal.gotIt')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}