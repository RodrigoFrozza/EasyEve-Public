import { cn } from '@/lib/utils'

export function AdminBadge({ 
  status, 
  children,
  className
}: { 
  status: 'success' | 'warning' | 'error' | 'info' | 'default'
  children: React.ReactNode
  className?: string
}) {
  const statusClasses = {
    success: 'bg-[rgba(16,185,129,.08)] border-[rgba(16,185,129,.2)] text-ta-success',
    warning: 'bg-[rgba(224,169,74,.09)] border-[rgba(224,169,74,.24)] text-ta-warning',
    error: 'bg-[rgba(244,114,114,.08)] border-[rgba(244,114,114,.22)] text-ta-danger',
    info: 'bg-[rgba(110,168,254,.08)] border-[rgba(110,168,254,.24)] text-ta-info',
    default: 'bg-white/[0.04] border-white/[0.08] text-ta-muted'
  }

  const dotClasses = {
    success: 'bg-ta-success',
    warning: 'bg-ta-warning',
    error: 'bg-ta-danger',
    info: 'bg-ta-info',
    default: 'bg-ta-faint'
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-2 px-[9px] py-[3px] rounded-[6px] text-[9.5px] font-semibold uppercase tracking-[0.06em] border whitespace-nowrap font-accent',
      statusClasses[status],
      className
    )}>
      <div className={cn('w-1.5 h-1.5 rounded-full', dotClasses[status])} />
      {children}
    </span>
  )
}

