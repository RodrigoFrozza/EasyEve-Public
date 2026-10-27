import { cn } from '@/lib/utils'

interface Column<T> {
  key: string
  header: string
  render: (item: T) => React.ReactNode
  className?: string
}

interface AdminDataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyExtractor: (item: T) => string
  emptyMessage?: string
  rowClassName?: (item: T) => string | undefined
  footer?: React.ReactNode
  showRowNumbers?: boolean
}

export function AdminDataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = 'No data available',
  rowClassName,
  footer,
  showRowNumbers = false,
}: AdminDataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-white/[0.13] bg-ta-inset p-12 text-center">
        <p className="text-sm font-medium text-ta-body">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="ta-panel overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06] bg-ta-header">
              {showRowNumbers && (
                <th className="w-12 px-4 py-3 text-left font-accent text-[10px] font-semibold uppercase tracking-[0.12em] text-ta-faint">
                  #
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left font-accent text-[10px] font-semibold uppercase tracking-[0.12em] text-ta-faint',
                    col.className
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {data.map((item, idx) => (
              <tr
                key={keyExtractor(item)}
                className={cn(
                  'transition-colors hover:bg-ta-row-hover',
                  rowClassName?.(item)
                )}
              >
                {showRowNumbers && (
                  <td className="px-4 py-3 text-xs text-ta-muted tabular-nums">
                    {idx + 1}
                  </td>
                )}
                {columns.map((col) => (
                  <td key={col.key} className={cn('px-4 py-[13px]', col.className)}>
                    {col.render(item)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer && (
        <div className="border-t border-white/[0.06] bg-ta-inset px-4 py-3">{footer}</div>
      )}
    </div>
  )
}
