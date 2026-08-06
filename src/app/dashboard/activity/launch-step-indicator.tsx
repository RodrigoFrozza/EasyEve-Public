'use client'

import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

type LaunchStepIndicatorProps = {
  currentStep: number
}

const STEPS = [
  'Select Activity',
  'Required Inputs',
  'Optional Settings',
  'Review and Launch',
]

export function LaunchStepIndicator({ currentStep }: LaunchStepIndicatorProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-tour="launch-step-indicator">
      {STEPS.map((label, index) => {
        const stepNumber = index + 1
        const isDone = currentStep > stepNumber
        const isCurrent = currentStep === stepNumber
        return (
          <div
            key={label}
            className={cn(
              'rounded-lg border px-2 py-2 text-[10px] uppercase tracking-wide',
              isCurrent && 'border-eve-accent bg-eve-accent/10 text-white',
              isDone && 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
              !isDone && !isCurrent && 'border-zinc-800 bg-zinc-900/30 text-zinc-500'
            )}
          >
            <div className="mb-1 flex items-center gap-1 font-black">
              {isDone ? <Check className="h-3 w-3" /> : <span>{stepNumber}.</span>}
              <span>{label}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
