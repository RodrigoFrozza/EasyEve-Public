'use client'

import { cn } from '@/lib/utils'
import { ViewMode } from './ViewModeToggle'
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip'
import { ModifierBreakdown } from '../ModifierBreakdown'

interface ResistanceData {
  layer: 'shield' | 'armor' | 'hull'
  em: number
  explosive: number
  kinetic: number
  thermal: number
  ehp: number
}

interface ResistanceBarsProps {
  data: ResistanceData[]
  viewMode: ViewMode
  className?: string
  history?: any
}

const RESISTANCE_COLORS = {
  em: { bar: 'bg-orange-500', label: 'EM', text: 'text-orange-400', historySuffix: 'EM Resist' },
  explosive: { bar: 'bg-yellow-500', label: 'Exp', text: 'text-yellow-400', historySuffix: 'Explosive Resist' },
  kinetic: { bar: 'bg-blue-500', label: 'Kin', text: 'text-blue-400', historySuffix: 'Kinetic Resist' },
  thermal: { bar: 'bg-red-500', label: 'Therm', text: 'text-red-400', historySuffix: 'Thermal Resist' }
}

const LAYER_COLORS = {
  shield: { border: 'border-blue-500/30', bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Shield' },
  armor: { border: 'border-yellow-500/30', bg: 'bg-yellow-500/10', text: 'text-yellow-400', label: 'Armor' },
  hull: { border: 'border-red-500/30', bg: 'bg-red-500/10', text: 'text-red-400', label: 'Hull' }
}

const LAYER_ORDER: Array<'shield' | 'armor' | 'hull'> = ['shield', 'armor', 'hull']

function formatEhp(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return value.toFixed(0)
}

export const ResistanceBars: React.FC<ResistanceBarsProps> = ({
  data,
  viewMode,
  className,
  history
}) => {
  const dataMap = new Map(data.map(d => [d.layer, d]))

  return (
    <div className={cn("space-y-2", className)}>
      {LAYER_ORDER.map(layer => {
        const layerData = dataMap.get(layer)
        if (!layerData) return null
        
        const colors = LAYER_COLORS[layer]
        const resistanceTypes: Array<'em' | 'explosive' | 'kinetic' | 'thermal'> = ['em', 'explosive', 'kinetic', 'thermal']

        return (
          <div
            key={layer}
            className={cn(
              "rounded-lg p-2 border",
              colors.border,
              colors.bg
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className={cn('text-xs font-semibold tracking-tight', colors.text)}>
                {colors.label}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">EHP</span>
                <span className="text-xs font-semibold tabular-nums text-foreground">
                  {formatEhp(layerData.ehp)}
                </span>
              </div>
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              {resistanceTypes.map(type => {
                const resValue = layerData[type]
                const resColors = RESISTANCE_COLORS[type]
                const percentage = resValue * 100
                const historyKey = `${layer.charAt(0).toUpperCase() + layer.slice(1)} ${resColors.historySuffix}`
                const historyData = history?.[historyKey]

                const content = (
                  <div className="flex flex-col items-center gap-1 cursor-help group">
                    <div className="flex w-full items-center gap-1">
                      <span
                        className={cn(
                          'text-[10px] font-semibold uppercase tracking-wide text-foreground/85',
                          resColors.text
                        )}
                      >
                        {resColors.label}
                      </span>
                    </div>
                    
                    {viewMode !== 'pure' && (
                      <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            resColors.bar
                          )}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    )}
                    
                    <span
                      className={cn(
                        'text-xs font-semibold tabular-nums text-foreground transition-colors group-hover:text-foreground',
                        resColors.text
                      )}
                    >
                      {percentage.toFixed(0)}%
                    </span>
                  </div>
                )

                if (historyData) {
                  return (
                    <TooltipProvider key={type}>
                      <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                          {content}
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="p-0 border-none bg-transparent">
                          <ModifierBreakdown 
                            label={`${colors.label} ${resColors.label}`}
                            base={historyData.base}
                            final={historyData.final}
                            modifiers={historyData.modifiers}
                            unit="%"
                          />
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                }

                return <div key={type}>{content}</div>
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
