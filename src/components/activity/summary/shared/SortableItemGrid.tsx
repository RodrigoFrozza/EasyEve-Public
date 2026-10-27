'use client'

import { useState, useMemo } from 'react'
import { formatISK, formatNumber, cn } from '@/lib/utils'
import { Search, ArrowUpDown, ChevronDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import Image from 'next/image'

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
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <Input
            placeholder="SEARCH ITEMS..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-black border-eve-border/30 h-9 rounded-none text-[11px] font-mono uppercase tracking-wider focus:ring-0 focus:border-eve-accent/50 transition-none"
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
                "h-9 px-3 rounded-none text-[10px] font-bold uppercase tracking-[0.2em] border transition-none font-mono",
                sortKey === key 
                  ? "bg-eve-accent/10 border-eve-accent text-eve-accent" 
                  : "bg-black border-eve-border/30 text-zinc-500 hover:text-eve-accent hover:border-eve-accent/50 hover:bg-eve-accent/5"
              )}
            >
              {key}
              {sortKey === key && (
                <ArrowUpDown className={cn(
                  "ml-1.5 w-3 h-3",
                  sortDir === 'asc' ? "" : "rotate-180"
                )} />
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {displayedItems.map((item, idx) => (
          <div 
            key={`${item.typeId || 'item'}-${idx}`}
            className="flex items-center gap-3 p-2.5 bg-black border border-eve-border/20 rounded-none hover:border-eve-accent/30 transition-none group"
          >
            <div className="relative w-10 h-10 shrink-0 rounded-none overflow-hidden bg-zinc-900 border border-eve-border/10">
              <Image
                src={`https://images.evetech.net/types/${item.typeId || 0}/icon?size=64`}
                alt={item.name}
                width={40}
                height={40}
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              />
            </div>
            <div className="min-w-0 flex-1 font-mono">
              <p className="text-[11px] font-bold text-zinc-400 uppercase truncate tracking-wider group-hover:text-eve-accent transition-colors">
                {item.name}
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-[10px] font-black text-eve-accent uppercase">
                  ×{formatNumber(item.quantity)}
                </span>
                <span className="text-[10px] text-zinc-800">|</span>
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-tight">
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
          className="w-full h-12 rounded-none border border-dashed border-eve-border/20 bg-black hover:border-eve-accent/50 hover:bg-eve-accent/5 text-[10px] font-bold uppercase tracking-[0.3em] text-zinc-500 hover:text-eve-accent transition-none font-mono"
        >
          {isExpanded ? "COLLAPSE LIST" : `VIEW ALL DATA [${filteredItems.length} ENTRIES]`}
          <ChevronDown className={cn(
            "ml-2 w-3.5 h-3.5 transition-none",
            isExpanded && "rotate-180"
          )} />
        </Button>
      )}

      {filteredItems.length === 0 && (
        <div className="py-10 text-center bg-black border border-dashed border-eve-border/20 rounded-none">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-700 font-mono">
            NO RECORD MATCHES QUERY
          </p>
        </div>
      )}
    </div>

  )
}
