'use client'

import { useState, useMemo, useCallback, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface VirtualizedListProps<T> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  keyExtractor: (item: T, index: number) => string | number
  /** Items per page for pagination */
  pageSize?: number
  /** Show load more button */
  showLoadMore?: boolean
  /** Container class */
  className?: string
  /** Item container class */
  itemClassName?: string
}

export function VirtualizedList<T>({
  items,
  renderItem,
  keyExtractor,
  pageSize = 50,
  showLoadMore = true,
  className = '',
  itemClassName = ''
}: VirtualizedListProps<T>) {
  const [visibleCount, setVisibleCount] = useState(pageSize)

  useEffect(() => {
    setVisibleCount(pageSize)
  }, [items, pageSize])

  const visibleItems = useMemo(() => {
    return items.slice(0, visibleCount)
  }, [items, visibleCount])

  const hasMore = visibleCount < items.length

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + pageSize, items.length))
  }, [pageSize, items.length])

  if (items.length === 0) {
    return null
  }

  return (
    <div className={className}>
      <div className="space-y-3">
        {visibleItems.map((item, index) => (
          <div key={keyExtractor(item, index)} className={itemClassName}>
            {renderItem(item, index)}
          </div>
        ))}
      </div>
      
      {showLoadMore && hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={loadMore}
            className="px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-white bg-zinc-900/60 hover:bg-zinc-800 border border-white/10 rounded-xl transition-all duration-300"
          >
            SHOW MORE ({items.length - visibleCount} REMAINING)
          </button>
        </div>
      )}
    </div>
  )
}