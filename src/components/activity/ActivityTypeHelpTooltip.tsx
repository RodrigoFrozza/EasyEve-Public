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
import { HelpCircle, Target, Package, Pickaxe, Map, Swords, Compass, AlertTriangle, Recycle } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { cn } from '@/lib/utils'

type ActivityType = 'ratting' | 'mining' | 'abyssal' | 'exploration' | 'salvaging' | 'pvp' | 'crab' | 'escalations'

interface ActivityTypeHelpTooltipProps {
  activityType: ActivityType
  className?: string
}

const ACTIVITY_ICONS: Record<ActivityType, React.ElementType> = {
  ratting: Target,
  mining: Pickaxe,
  abyssal: Package,
  exploration: Map,
  salvaging: Recycle,
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
    salvaging: {
      title: t('activity.typeHelp.salvaging.title'),
      subtitle: t('activity.typeHelp.salvaging.subtitle'),
      whatIsIt: t('activity.typeHelp.salvaging.whatIsIt'),
      steps: [
        t('activity.typeHelp.salvaging.step1'),
        t('activity.typeHelp.salvaging.step2'),
        t('activity.typeHelp.salvaging.step3'),
      ],
      importantNote: t('activity.typeHelp.salvaging.importantNote'),
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
            "h-7 w-7 rounded-none bg-zinc-950 border border-zinc-900",
            "hover:bg-zinc-900 transition-none",
            "shadow-none",
            className
          )}
          aria-label={`Help for ${activityType}`}
        >
          <span className="text-zinc-500 font-black text-xs font-mono">?</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-black border-zinc-900 text-white max-w-md p-0 gap-0 rounded-none shadow-none">
        <div className="bg-zinc-950 p-4 border-b border-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-lg font-black uppercase tracking-tighter flex items-center gap-2 font-mono">
              <div className="h-8 w-8 rounded-none bg-zinc-900 flex items-center justify-center border border-zinc-800">
                <Icon className="h-4 w-4 text-zinc-400" />
              </div>
              {content.title}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 uppercase font-black text-[10px] tracking-widest mt-1 font-mono">
              {content.subtitle}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-4 space-y-4 bg-black">
          <div className="bg-zinc-950 rounded-none p-3 border border-zinc-900 font-mono">
            <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-2">
              {t('activity.typeHelp.whatIsIt')}
            </h4>
            <p className="text-[10px] text-zinc-500 leading-relaxed uppercase font-bold tracking-wider">
              {content.whatIsIt}
            </p>
          </div>

          <div className="bg-zinc-950 rounded-none p-3 border border-zinc-900 font-mono">
            <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-2">
              {t('activity.typeHelp.howToConfigure')}
            </h4>
            <ul className="space-y-2">
              {content.steps.map((step, index) => (
                <li key={index} className="flex items-start gap-2 text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                  <span className="h-5 w-5 rounded-none bg-zinc-900 flex items-center justify-center shrink-0 mt-0.5 border border-zinc-800">
                    <span className="text-zinc-400 text-[10px] font-black">{String(index + 1).padStart(2, '0')}</span>
                  </span>
                  <span className="flex-1 leading-relaxed">{step}</span>
                </li>
              ))}
            </ul>
          </div>

          {content.importantNote && (
            <div className="bg-blue-600/5 border border-blue-600/20 rounded-none p-3 flex items-start gap-2">
              <HelpCircle className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-400/80 leading-relaxed uppercase font-black tracking-widest font-mono">
                {content.importantNote}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end p-4 border-t border-zinc-900 bg-zinc-950">
          <Button className="bg-blue-600 text-white font-black uppercase text-xs tracking-widest h-10 rounded-none hover:bg-blue-500 transition-none shadow-none">
            {t('activity.typeHelp.gotIt')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}