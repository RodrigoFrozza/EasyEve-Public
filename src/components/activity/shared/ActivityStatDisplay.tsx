import React, { useMemo } from 'react'
import { cn, formatISK, formatNumber, formatCompactNumber, formatCurrencyValue } from '@/lib/utils'

interface ActivityStatDisplayProps {
  label: string
  value: string | number
  subValue?: string
  icon?: React.ReactNode
  variant?: 'default' | 'accent' | 'warning' | 'success' | 'danger'
  /** Dense layout (matches compact activity metric cards). */
  size?: 'default' | 'compact'
  /** Override main value color (e.g. thematic compact cards). */
  valueClassName?: string
  className?: string
  isLoading?: boolean
  children?: React.ReactNode
  onClick?: () => void
  /** Format value as ISK currency */
  formatAsISK?: boolean
  /** Format value as compact ISK (K, M, B) */
  formatAsCompactISK?: boolean
  /** Format value as number with thousand separators */
  formatAsNumber?: boolean
}

export function ActivityStatDisplay({
  label,
  value,
  subValue,
  icon,
  variant = 'default',
  size = 'default',
  valueClassName,
  className,
  isLoading,
  children,
  onClick,
  formatAsISK = false,
  formatAsCompactISK = false,
  formatAsNumber = false
}: ActivityStatDisplayProps) {
  const variantColors = {
    default: 'text-zinc-400',
    accent: 'text-blue-500',
    warning: 'text-amber-500',
    success: 'text-emerald-500',
    danger: 'text-rose-500'
  }

  const borderColors = {
    default: 'border-white/5',
    accent: 'border-blue-500/20',
    warning: 'border-amber-500/20',
    success: 'border-emerald-500/20',
    danger: 'border-rose-500/20'
  }

  const bgColors = {
    default: 'bg-white/[0.02]',
    accent: 'bg-blue-500/[0.02]',
    warning: 'bg-amber-500/[0.02]',
    success: 'bg-emerald-500/[0.02]',
    danger: 'bg-rose-500/[0.02]'
  }

  const isCompact = size === 'compact'

  const formattedValue = useMemo(() => {
    if (formatAsISK) return formatISK(value as number)
    if (formatAsCompactISK) return formatCurrencyValue(value as number)
    if (formatAsNumber) return formatCompactNumber(value as number)
    return value
  }, [value, formatAsISK, formatAsCompactISK, formatAsNumber])

  if (isLoading) {
    return (
      <div className={cn("animate-pulse bg-zinc-900/50 rounded-xl border border-white/5", isCompact ? "h-14" : "h-20", className)} />
    )
  }

  return (
    <div 
      className={cn(
        "relative group flex flex-col rounded-xl border transition-all duration-300",
        isCompact ? "p-3" : "p-4",
        "bg-zinc-950/40 backdrop-blur-md",
        borderColors[variant],
        bgColors[variant],
        "hover:bg-zinc-900/60 hover:border-white/20",
        !isCompact && "hover:-translate-y-0.5",
        onClick && "cursor-pointer active:scale-[0.98]",
        className
      )}
      onClick={onClick}
    >
      {/* Micro-texture Scanline */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02] group-hover:opacity-[0.04] overflow-hidden rounded-xl transition-opacity">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] z-[1] bg-[length:100%_2px,3px_100%] animate-scanline" />
      </div>

      <div className={cn("flex items-center justify-between", isCompact ? "mb-1" : "mb-2 gap-2")}>
        <span className={cn(
          "font-black uppercase tracking-widest text-zinc-500 font-outfit",
          isCompact ? "text-[9px] tracking-wider" : "text-[10px] tracking-[0.2em]"
        )}>
          {label}
        </span>
        {icon && (
          <div className={cn("opacity-70 group-hover:opacity-100 transition-opacity shrink-0", variantColors[variant])}>
            {icon}
          </div>
        )}
      </div>

      <div className="flex flex-col min-w-0 flex-1 justify-center">
        <div className="flex flex-col">
          <span className={cn(
            "font-black tracking-tight font-inter transition-colors leading-tight",
            isCompact ? "text-sm" : "text-xl",
            valueClassName || (variant === 'default' ? 'text-zinc-100' : variantColors[variant])
          )}>
            {formattedValue}
          </span>
          <span className={cn(
            "font-bold text-zinc-500 font-outfit uppercase tracking-tight truncate leading-none mt-0.5",
            isCompact ? "text-[9px]" : "text-[11px]"
          )}>
            {subValue || '-'}
          </span>
        </div>
      </div>

      {children && (
        <div className={cn("relative z-10", isCompact ? "mt-2" : "mt-3")}>
          {children}
        </div>
      )}

      {/* Top Gloss Edge */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      {/* Interaction Ripple (Simulated) */}
      <div className="absolute inset-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  )
}
