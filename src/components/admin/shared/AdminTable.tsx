import { cn } from '@/lib/utils'
import { Sparkles, Hash } from 'lucide-react'

interface Column<T> {
  key: string
  header: string
  render: (item: T) => React.ReactNode
  className?: string
}

interface AdminTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (item: T) => string
  emptyMessage?: string
  /** Optional per-row class (e.g. highlight filtered rows) */
  rowClassName?: (item: T) => string | undefined
}

export function AdminTable<T>({ 
  columns, 
  data, 
  keyExtractor, 
  emptyMessage = 'No data available',
  rowClassName,
}: AdminTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-muted-foreground bg-card/10 backdrop-blur-xl border border-border/40 border-dashed rounded-[2.5rem] shadow-inner animate-in fade-in duration-700">
        <div className="w-20 h-20 rounded-[1.5rem] bg-muted/20 flex items-center justify-center mb-8 border border-border/20 shadow-xl relative">
          <Sparkles className="w-8 h-8 text-primary/30" />
          <div className="absolute inset-0 bg-primary/5 blur-xl rounded-full" />
        </div>
        <div className="space-y-2 text-center">
          <span className="text-xl font-black text-foreground tracking-tight block uppercase tracking-[0.1em]">No Records Identified</span>
          <span className="text-xs font-medium text-muted-foreground/60 italic leading-relaxed max-w-xs block mx-auto">{emptyMessage}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden bg-card/20 backdrop-blur-xl border border-border/40 rounded-[2rem] shadow-2xl shadow-black/10 font-sans animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-border/40 bg-muted/30">
              <th className="w-16 p-6 text-center text-muted-foreground/30 font-black border-r border-border/10 uppercase tracking-[0.2em] text-[9px]">
                <Hash className="w-3.5 h-3.5 mx-auto opacity-40" />
              </th>
              {columns.map((col) => (
                <th 
                  key={col.key}
                  className={cn(
                    'text-left p-6 text-muted-foreground/80 font-black uppercase tracking-[0.2em] text-[10px] border-r border-border/10 last:border-r-0', 
                    col.className
                  )}
                >
                  <span className="flex items-center gap-2">
                    {col.header}
                    <div className="h-1 w-1 rounded-full bg-primary/40" />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/10">
            {data.map((item, idx) => (
              <tr 
                key={keyExtractor(item)}
                className={cn(
                  'group relative hover:bg-primary/[0.03] transition-all duration-500',
                  rowClassName?.(item)
                )}
              >
                <td className="p-6 text-center text-muted-foreground/40 font-black text-[10px] border-r border-border/10 bg-muted/5 group-hover:bg-primary/5 transition-all duration-500 font-mono">
                  {(idx + 1).toString().padStart(2, '0')}
                </td>
                {columns.map((col, colIdx) => (
                  <td key={col.key} className={cn('p-6 border-r border-border/10 last:border-r-0 relative transition-colors duration-500', col.className)}>
                    {/* Hover indicator line - only on the first data column */}
                    {colIdx === 0 && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-3/5 bg-primary/60 rounded-full scale-y-0 group-hover:scale-y-100 transition-transform duration-500 origin-center shadow-[0_0_10px_rgba(var(--primary),0.5)]" />
                    )}
                    <div className="relative z-10 group-hover:translate-x-0.5 transition-transform duration-500">
                      {col.render(item)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Table Footer / Info Bar */}
      <div className="px-8 py-4 bg-muted/20 border-t border-border/20 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
          <span className="text-[9px] text-muted-foreground/60 font-black uppercase tracking-[0.2em]">Data_Transmission_Stable</span>
        </div>
        <p className="text-[9px] text-muted-foreground/40 font-black uppercase tracking-[0.2em]">
          Registry_Count: {data.length.toString().padStart(2, '0')}
        </p>
      </div>
    </div>
  )
}


