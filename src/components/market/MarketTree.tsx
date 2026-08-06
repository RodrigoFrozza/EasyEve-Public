'use client'

import React, { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ItemInfo } from '@/lib/constants/market'

interface TreeItem {
  typeId: number
  name: string
  groupId: number
  groupName: string
  volume?: number
}

// Recursive: EVE market groups nest to arbitrary depth (e.g. Ship Equipment >
// Turrets & Bays > Projectile Weapons > Autocannons), and intermediate
// groups can carry their own items too, not just leaves. A fixed
// category/group 2-level shape would silently drop deeper branches.
interface GroupNode {
  id: number
  name: string
  children: GroupNode[]
  items: TreeItem[]
}

interface MarketTreeProps {
  categories: GroupNode[]
  selectedItem: ItemInfo | null
  onItemSelect: (item: ItemInfo) => void
  searchQuery: string
  onSearchChange: (query: string) => void
}

function countItems(node: GroupNode): number {
  return node.items.length + node.children.reduce((acc, child) => acc + countItems(child), 0)
}

function nodeMatchesSearch(node: GroupNode, query: string): boolean {
  const q = query.toLowerCase()
  if (node.items.some(item => item.name.toLowerCase().includes(q))) return true
  return node.children.some(child => nodeMatchesSearch(child, q))
}

function MarketGroupNodeComponent({
  node,
  depth,
  selectedItem,
  onItemSelect,
  searchQuery,
}: {
  node: GroupNode
  depth: number
  selectedItem: ItemInfo | null
  onItemSelect: (item: ItemInfo) => void
  searchQuery: string
}) {
  // Everything starts collapsed — with ~2300 items in Ship Equipment alone, an
  // expanded top level buries the search bar in a wall of categories.
  const [manuallyOpen, setManuallyOpen] = useState(false)
  const isSearching = searchQuery.length >= 2

  const filteredItems = useMemo(() => {
    if (!isSearching) return node.items
    const q = searchQuery.toLowerCase()
    return node.items.filter(item => item.name.toLowerCase().includes(q))
  }, [node.items, searchQuery, isSearching])

  if (isSearching && !nodeMatchesSearch(node, searchQuery)) return null

  // While searching, force every matching branch open so results are visible
  // without manual expansion.
  const isOpen = isSearching ? true : manuallyOpen
  const totalCount = countItems(node)
  const indent = 8 + depth * 12

  return (
    <div className="select-none">
      <button
        onClick={() => setManuallyOpen(open => !open)}
        className={cn(
          'flex items-center gap-1 w-full py-1.5 text-left hover:bg-zinc-800/50 rounded transition-colors',
          depth === 0
            ? 'text-xs font-semibold text-zinc-200'
            : 'text-xs font-medium text-zinc-400 hover:bg-zinc-800/30'
        )}
        style={{ paddingLeft: `${indent}px` }}
      >
        {isOpen ? (
          <ChevronDown className={cn('w-3 h-3 shrink-0', depth === 0 && 'text-eve-accent')} />
        ) : (
          <ChevronRight className={cn('w-3 h-3 shrink-0', depth === 0 && 'text-eve-accent')} />
        )}
        <span className="truncate">{node.name}</span>
        <span className="ml-auto text-zinc-600 text-[10px] pr-2">{totalCount}</span>
      </button>

      {isOpen && (
        <div className="flex flex-col">
          {node.children.map(child => (
            <MarketGroupNodeComponent
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedItem={selectedItem}
              onItemSelect={onItemSelect}
              searchQuery={searchQuery}
            />
          ))}
          {filteredItems.map(item => (
            <button
              key={item.typeId}
              onClick={() => onItemSelect({
                typeId: item.typeId,
                name: item.name,
                groupId: item.groupId,
                groupName: item.groupName,
                categoryId: 0,
                categoryName: '',
                volume: item.volume,
                published: true
              })}
              className={cn(
                'flex items-center gap-2 w-full py-1 text-left text-xs hover:bg-eve-accent/20 rounded transition-colors',
                selectedItem?.typeId === item.typeId && 'bg-eve-accent/30 text-eve-accent'
              )}
              style={{ paddingLeft: `${indent + 16}px` }}
            >
              <span className="truncate text-zinc-400">{item.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function MarketTree({
  categories,
  selectedItem,
  onItemSelect,
  searchQuery,
  onSearchChange
}: MarketTreeProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="relative shrink-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full h-9 pl-9 pr-3 bg-eve-panel border border-eve-border rounded text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-eve-accent/50"
        />
      </div>

      <div className="flex-1 overflow-y-auto mt-2">
        {categories.length === 0 ? (
          <div className="text-center text-zinc-500 text-sm py-8">
            Loading market...
          </div>
        ) : (
          <div className="space-y-0.5">
            {categories.map(node => (
              <MarketGroupNodeComponent
                key={node.id}
                node={node}
                depth={0}
                selectedItem={selectedItem}
                onItemSelect={onItemSelect}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
