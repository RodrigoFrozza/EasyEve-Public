import React, { useMemo } from 'react'
import { cn, formatISK, formatNumber, formatCompactNumber, formatCurrencyValue } from '@/lib/utils'

interface ActivityStatDisplayProps {
  label: string
  value: string | number
  subValue?: string
  icon?: React.ReactNode
  variant?: 'default' | 'accent' | 'warning' | 'success' | 'danger'
  /** Dense layout (matches compact activity metric cards). */
  size?: 'default' | 'compact' | 'comfortable'
  /** Main value typography — numeric avoids uppercase on ISK amounts. */
  valueTypography?: 'default' | 'numeric'
  /** Override main value color (e.g. thematic compact cards). */
  valueClassName?: string
  /** Override label color in compact metric cards */
  labelClassName?: string
  /** Override sub-value color (compact cards) */
  subValueClassName?: string
  /** Native tooltip / a11y hint for clickable stats */
  title?: string
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
  valueTypography = 'default',
  valueClassName,
  labelClassName,
  subValueClassName,
  title,
  className,
  isLoading,
  children,
  onClick,
  formatAsISK = false,
  formatAsCompactISK = false,
  formatAsNumber = false
}: ActivityStatDisplayProps) {
  const variantColors = {
    default: 'text-zinc-500',
    accent: 'text-eve-accent',
    warning: 'text-amber-500',
    success: 'text-emerald-500',
    danger: 'text-red-500'
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
  const isComfortable = size === 'comfortable'
  const isNumericValue = valueTypography === 'numeric' || isComfortable

  const formattedValue = useMemo(() => {
    if (formatAsISK) return formatISK(value as number)
    if (formatAsCompactISK) return formatCurrencyValue(value as number)
    if (formatAsNumber) return formatCompactNumber(value as number)
    return value
  }, [value, formatAsISK, formatAsCompactISK, formatAsNumber])

  if (isLoading) {
    return (
      <div className={cn("animate-pulse bg-black rounded-none border border-eve-border/20", isCompact ? "h-14" : "h-20", className)} />
    )
  }

  return (
    <div
      title={title}
      className={cn(
        'relative flex flex-col transition-colors',
        onClick && 'cursor-pointer',
        isCompact
          ? className
          : isComfortable
            ? cn('rounded-xl border border-eve-border/30 bg-black/20 p-3.5 sm:p-4', className)
            : cn(
                'rounded-none border border-eve-border/30 bg-black p-4',
                className
              )
      )}
      onClick={onClick}
    >
      <div className={cn('flex items-center justify-between', isCompact || isComfortable ? 'mb-1.5' : 'mb-2 gap-2')}>
        <span
          className={cn(
            'font-bold uppercase font-mono',
            isComfortable
              ? 'text-[11px] tracking-wider'
              : isCompact
                ? 'text-[10px] tracking-[0.14em]'
                : 'text-[10px] tracking-[0.2em] font-black text-zinc-500',
            !isComfortable && !isCompact && 'text-zinc-500',
            labelClassName
          )}
        >
          {label}
        </span>
        {icon && (
          <div className={cn('shrink-0 opacity-75', variantColors[variant])}>
            {icon}
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex flex-col">
          <span
            className={cn(
              'font-bold leading-tight font-mono',
              isComfortable
                ? 'text-lg sm:text-xl tabular-nums tracking-tight'
                : isCompact
                  ? 'text-sm font-black tracking-widest uppercase'
                  : 'text-xl font-black tracking-widest uppercase',
              isNumericValue && (isComfortable || isCompact) && 'normal-case tracking-tight tabular-nums',
              valueClassName || (variant === 'default' ? 'text-zinc-200' : variantColors[variant])
            )}
          >
            {formattedValue}
          </span>
          {subValue && (
            <span
              className={cn(
                'mt-1 font-mono font-semibold leading-snug',
                isComfortable
                  ? 'text-[11px] normal-case tracking-normal'
                  : isCompact
                    ? 'text-[10px] font-bold uppercase leading-none tracking-wider'
                    : 'text-[10px] font-bold uppercase leading-none tracking-wider',
                subValueClassName ?? 'text-zinc-500'
              )}
            >
              {subValue}
            </span>
          )}
        </div>
      </div>

      {children && (
        <div className={cn("relative z-10", isCompact ? "mt-2" : "mt-3")}>
          {children}
        </div>
      )}
    </div>
  )
}
