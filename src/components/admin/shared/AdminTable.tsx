import { cn } from '@/lib/utils'

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
      <div className="text-center p-8 text-eve-text/40">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-eve-border/40">
            {columns.map((col) => (
              <th 
                key={col.key}
                className={cn('text-left p-3 text-eve-text/60 font-medium', col.className)}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr 
              key={keyExtractor(item)}
              className={cn(
                'border-b border-eve-border/20 hover:bg-eve-accent/5 transition-colors',
                rowClassName?.(item)
              )}
            >
              {columns.map((col) => (
                <td key={col.key} className={cn('p-3', col.className)}>
                  {col.render(item)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
