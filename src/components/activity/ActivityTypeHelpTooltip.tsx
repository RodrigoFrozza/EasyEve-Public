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
import { HelpCircle, Target, Package, Pickaxe, Map, Swords, Compass, AlertTriangle } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { cn } from '@/lib/utils'

type ActivityType = 'ratting' | 'mining' | 'abyssal' | 'exploration' | 'pvp' | 'crab' | 'escalations'

interface ActivityTypeHelpTooltipProps {
  activityType: ActivityType
  className?: string
}

const ACTIVITY_ICONS: Record<ActivityType, React.ElementType> = {
  ratting: Target,
  mining: Pickaxe,
  abyssal: Package,
  exploration: Map,
  pvp: Swords,
  crab: Compass,
  escalations: AlertTriangle,
}

export function ActivityTypeHelpTooltip({ activityType, className }: ActivityTypeHelpTooltipProps) {
  const { t } = useTranslations()
  const Icon = ACTIVITY_ICONS[activityType]

  const content = {
    ratting: {
      title: t('activity.typeHelp.ratting.title'),
      subtitle: t('activity.typeHelp.ratting.subtitle'),
      whatIsIt: t('activity.typeHelp.ratting.whatIsIt'),
      steps: [
        t('activity.typeHelp.ratting.step1'),
        t('activity.typeHelp.ratting.step2'),
        t('activity.typeHelp.ratting.step3'),
        t('activity.typeHelp.ratting.step4'),
      ],
      importantNote: t('activity.typeHelp.ratting.importantNote'),
    },
    mining: {
      title: t('activity.typeHelp.mining.title'),
      subtitle: t('activity.typeHelp.mining.subtitle'),
      whatIsIt: t('activity.typeHelp.mining.whatIsIt'),
      steps: [
        t('activity.typeHelp.mining.step1'),
        t('activity.typeHelp.mining.step2'),
        t('activity.typeHelp.mining.step3'),
      ],
      importantNote: t('activity.typeHelp.mining.importantNote'),
    },
    abyssal: {
      title: t('activity.typeHelp.abyssal.title'),
      subtitle: t('activity.typeHelp.abyssal.subtitle'),
      whatIsIt: t('activity.typeHelp.abyssal.whatIsIt'),
      steps: [
        t('activity.typeHelp.abyssal.step1'),
        t('activity.typeHelp.abyssal.step2'),
        t('activity.typeHelp.abyssal.step3'),
      ],
      importantNote: t('activity.typeHelp.abyssal.importantNote'),
    },
    exploration: {
      title: t('activity.typeHelp.exploration.title'),
      subtitle: t('activity.typeHelp.exploration.subtitle'),
      whatIsIt: t('activity.typeHelp.exploration.whatIsIt'),
      steps: [
        t('activity.typeHelp.exploration.step1'),
        t('activity.typeHelp.exploration.step2'),
        t('activity.typeHelp.exploration.step3'),
      ],
      importantNote: t('activity.typeHelp.exploration.importantNote'),
    },
    pvp: {
      title: t('activity.typeHelp.pvp.title'),
      subtitle: t('activity.typeHelp.pvp.subtitle'),
      whatIsIt: t('activity.typeHelp.pvp.whatIsIt'),
      steps: [
        t('activity.typeHelp.pvp.step1'),
      ],
    },
    crab: {
      title: t('activity.typeHelp.crab.title'),
      subtitle: t('activity.typeHelp.crab.subtitle'),
      whatIsIt: t('activity.typeHelp.crab.whatIsIt'),
      steps: [
        t('activity.typeHelp.crab.step1'),
      ],
    },
    escalations: {
      title: t('activity.typeHelp.escalations.title'),
      subtitle: t('activity.typeHelp.escalations.subtitle'),
      whatIsIt: t('activity.typeHelp.escalations.whatIsIt'),
      steps: [
        t('activity.typeHelp.escalations.step1'),
      ],
    },
  }[activityType]

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-7 w-7 rounded-full bg-eve-accent/20 border border-eve-accent/50",
            "hover:bg-eve-accent/40 hover:scale-110 transition-all duration-300",
            "shadow-[0_0_10px_rgba(0,255,255,0.2)] animate-pulse-subtle",
            className
          )}
          aria-label={`Help for ${activityType}`}
        >
          <span className="text-eve-accent font-black text-sm">?</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-eve-panel border-eve-border text-white max-w-md p-0 gap-0">
        <div className="bg-gradient-to-r from-eve-accent/10 to-eve-panel p-4 border-b border-eve-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-eve-accent/20 flex items-center justify-center">
                <Icon className="h-4 w-4 text-eve-accent" />
              </div>
              {content.title}
            </DialogTitle>
            <DialogDescription className="text-zinc-400">
              {content.subtitle}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
              {t('activity.typeHelp.whatIsIt')}
            </h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              {content.whatIsIt}
            </p>
          </div>

          <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-800">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
              {t('activity.typeHelp.howToConfigure')}
            </h4>
            <ul className="space-y-2">
              {content.steps.map((step, index) => (
                <li key={index} className="flex items-start gap-2 text-xs text-zinc-400">
                  <span className="h-5 w-5 rounded-full bg-eve-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-eve-accent text-[10px] font-black">{index + 1}</span>
                  </span>
                  <span className="flex-1 leading-relaxed">{step}</span>
                </li>
              ))}
            </ul>
          </div>

          {content.importantNote && (
            <div className="bg-eve-accent/10 border border-eve-accent/30 rounded-lg p-3 flex items-start gap-2">
              <HelpCircle className="h-4 w-4 text-eve-accent shrink-0 mt-0.5" />
              <p className="text-xs text-eve-accent/80 leading-relaxed">
                {content.importantNote}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end p-4 border-t border-eve-border/50">
          <Button className="bg-eve-accent text-black font-bold hover:bg-eve-accent/80">
            {t('activity.typeHelp.gotIt')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}