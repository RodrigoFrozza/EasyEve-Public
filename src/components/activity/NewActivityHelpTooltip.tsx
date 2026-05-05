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
import { HelpCircle, ChevronRight, Play, Target, Users, Zap } from 'lucide-react'
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
            "h-10 w-10 rounded-full bg-eve-accent/20 border-2 border-eve-accent",
            "hover:bg-eve-accent/30 hover:scale-110 transition-all duration-300",
            "shadow-[0_0_20px_rgba(0,255,255,0.3)] animate-pulse-subtle"
          )}
          aria-label="How to start a new activity"
        >
          <span className="text-eve-accent font-black text-lg">?</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-eve-panel border-eve-border text-white max-w-lg p-0 gap-0">
        <div className="bg-gradient-to-r from-eve-accent/20 to-eve-panel p-6 border-b border-eve-border">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-eve-accent/30 flex items-center justify-center">
                <HelpCircle className="h-5 w-5 text-eve-accent" />
              </div>
              {t('activity.helpModal.title')}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {t('activity.helpModal.subtitle')}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-6">
          {/* Step 1 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="h-10 w-10 rounded-full bg-eve-accent/20 border-2 border-eve-accent flex items-center justify-center">
                <span className="text-eve-accent font-black text-sm">1</span>
              </div>
              <div className="w-0.5 h-8 bg-eve-accent/30" />
            </div>
            <div className="flex-1 pt-1">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-eve-accent" />
                {t('activity.helpModal.step1.title')}
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {t('activity.helpModal.step1.description')}
              </p>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="h-10 w-10 rounded-full bg-eve-accent/20 border-2 border-eve-accent flex items-center justify-center">
                <span className="text-eve-accent font-black text-sm">2</span>
              </div>
              <div className="w-0.5 h-8 bg-eve-accent/30" />
            </div>
            <div className="flex-1 pt-1">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                <Target className="h-4 w-4 text-eve-accent" />
                {t('activity.helpModal.step2.title')}
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {t('activity.helpModal.step2.description')}
              </p>
            </div>
          </div>

          {/* Step 3 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="h-10 w-10 rounded-full bg-eve-accent/20 border-2 border-eve-accent flex items-center justify-center">
                <span className="text-eve-accent font-black text-sm">3</span>
              </div>
              <div className="w-0.5 h-8 bg-eve-accent/30" />
            </div>
            <div className="flex-1 pt-1">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-eve-accent" />
                {t('activity.helpModal.step3.title')}
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {t('activity.helpModal.step3.description')}
              </p>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className="h-10 w-10 rounded-full bg-eve-accent/20 border-2 border-eve-accent flex items-center justify-center">
                <span className="text-eve-accent font-black text-sm">4</span>
              </div>
            </div>
            <div className="flex-1 pt-1">
              <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-1">
                <Zap className="h-4 w-4 text-eve-accent" />
                {t('activity.helpModal.step4.title')}
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {t('activity.helpModal.step4.description')}
              </p>
            </div>
          </div>

          <div className="bg-eve-accent/10 border border-eve-accent/30 rounded-lg p-4 flex items-start gap-3">
            <Play className="h-5 w-5 text-eve-accent shrink-0 mt-0.5" />
            <p className="text-xs text-eve-accent/80 leading-relaxed">
              {t('activity.helpModal.tip')}
            </p>
          </div>
        </div>

        <div className="flex justify-end p-4 border-t border-eve-border/50">
          <Button className="bg-eve-accent text-black font-bold hover:bg-eve-accent/80">
            {t('activity.helpModal.gotIt')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}