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
    success: 'bg-green-500/20 text-green-400 border-green-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    default: 'bg-eve-panel/60 text-eve-text/60 border-eve-border/30'
  }

  return (
    <span className={cn(
      'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border whitespace-nowrap',
      statusClasses[status],
      className
    )}>
      {children}
    </span>
  )
}
