'use client'

import { useState, useMemo } from 'react'
import { formatISK, formatNumber, cn } from '@/lib/utils'
import { Search, ArrowUpDown, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface GridItem {
  id?: number | string
  typeId?: number
  name: string
  quantity: number
  value: number
  unitPrice?: number
}

interface SortableItemGridProps {
  items: GridItem[]
  title?: string
  limit?: number
  className?: string
}

export function SortableItemGrid({
  items,
  title,
  limit = 10,
  className
}: SortableItemGridProps) {
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<'value' | 'quantity' | 'name'>('value')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [isExpanded, setIsExpanded] = useState(false)

  const filteredItems = useMemo(() => {
    let result = items.filter(item => 
      item.name.toLowerCase().includes(search.toLowerCase())
    )

    result.sort((a, b) => {
      const aVal = sortKey === 'name' ? a.name : a[sortKey] || 0
      const bVal = sortKey === 'name' ? b.name : b[sortKey] || 0
      
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return result
  }, [items, search, sortKey, sortDir])

  const displayedItems = isExpanded ? filteredItems : filteredItems.slice(0, limit)
  const hasMore = filteredItems.length > limit

  const handleSort = (key: typeof sortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <Input
            placeholder="Search items..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white/5 border-white/5 h-10 rounded-xl text-xs"
          />
        </div>
        <div className="flex gap-2">
          {(['value', 'quantity', 'name'] as const).map((key) => (
            <Button
              key={key}
              variant="ghost"
              size="sm"
              onClick={() => handleSort(key)}
              className={cn(
                "h-10 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5",
                sortKey === key ? "bg-white/10 text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {key}
              {sortKey === key && (
                <ArrowUpDown className={cn(
                  "ml-2 w-3 h-3 transition-transform",
                  sortDir === 'asc' ? "rotate-0" : "rotate-180"
                )} />
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {displayedItems.map((item, idx) => (
          <div 
            key={`${item.typeId || 'item'}-${idx}`}
            className="flex items-center gap-4 p-3 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 hover:border-white/10 transition-all group"
          >
            <div className="relative w-12 h-12 shrink-0 rounded-xl overflow-hidden bg-zinc-900 border border-white/5">
              <img
                src={`https://images.evetech.net/types/${item.typeId || 0}/icon?size=64`}
                alt={item.name}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
              />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-black text-zinc-200 truncate group-hover:text-white transition-colors">
                {item.name}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] font-black text-zinc-500 font-mono">
                  ×{formatNumber(item.quantity)}
                </span>
                <span className="text-[10px] text-zinc-600">·</span>
                <span className="text-[10px] font-black text-zinc-400 font-mono">
                  {formatISK(item.value)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Show More */}
      {hasMore && (
        <Button
          variant="ghost"
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full py-6 rounded-2xl border border-dashed border-white/10 hover:border-white/20 hover:bg-white/5 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
        >
          {isExpanded ? "Show Less" : `Show All (${filteredItems.length} items)`}
          <ChevronDown className={cn(
            "ml-2 w-4 h-4 transition-transform",
            isExpanded && "rotate-180"
          )} />
        </Button>
      )}

      {filteredItems.length === 0 && (
        <div className="py-12 text-center bg-white/5 border border-dashed border-white/10 rounded-2xl">
          <p className="text-xs font-black uppercase tracking-widest text-zinc-600">
            No items found matching your search
          </p>
        </div>
      )}
    </div>
  )
}
