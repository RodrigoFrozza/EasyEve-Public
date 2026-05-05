'use client'

import React, { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown, Package, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ItemInfo } from '@/lib/constants/market'

interface TreeItem {
  typeId: number
  name: string
  groupId: number
  groupName: string
  volume?: number
}

interface GroupNode {
  id: number
  name: string
  items: TreeItem[]
}

interface CategoryNode {
  id: number
  name: string
  children: GroupNode[]
}

interface MarketTreeProps {
  categories: CategoryNode[]
  selectedItem: ItemInfo | null
  onItemSelect: (item: ItemInfo) => void
  searchQuery: string
  onSearchChange: (query: string) => void
}

function CategoryNodeComponent({ 
  category, 
  selectedItem, 
  onItemSelect, 
  searchQuery 
}: { 
  category: CategoryNode
  selectedItem: ItemInfo | null
  onItemSelect: (item: ItemInfo) => void
  searchQuery: string
}) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <div className="select-none">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 w-full px-2 py-1.5 text-left text-xs font-semibold text-zinc-200 hover:bg-zinc-800/50 rounded transition-colors"
      >
        {isOpen ? (
          <ChevronDown className="w-3 h-3 shrink-0 text-eve-accent" />
        ) : (
          <ChevronRight className="w-3 h-3 shrink-0 text-eve-accent" />
        )}
        <span className="truncate">{category.name}</span>
        <span className="ml-auto text-zinc-600 text-[10px]">
          {category.children.reduce((acc, g) => acc + g.items.length, 0)}
        </span>
      </button>

      {isOpen && (
        <div>
          {category.children.map(group => (
            <GroupNodeComponent
              key={group.id}
              group={group}
              selectedItem={selectedItem}
              onItemSelect={onItemSelect}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function GroupNodeComponent({ 
  group, 
  selectedItem, 
  onItemSelect, 
  searchQuery 
}: { 
  group: GroupNode
  selectedItem: ItemInfo | null
  onItemSelect: (item: ItemInfo) => void
  searchQuery: string
}) {
  const [isOpen, setIsOpen] = useState(false)

  const filteredItems = useMemo(() => {
    if (searchQuery.length < 2) return group.items
    return group.items.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [group.items, searchQuery])

  if (searchQuery.length >= 2 && filteredItems.length === 0) return null

  return (
    <div className="select-none">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 w-full px-2 py-1 text-left text-xs font-medium text-zinc-400 hover:bg-zinc-800/30 rounded transition-colors"
        style={{ paddingLeft: '16px' }}
      >
        {isOpen ? (
          <ChevronDown className="w-3 h-3 shrink-0" />
        ) : (
          <ChevronRight className="w-3 h-3 shrink-0" />
        )}
        <span className="truncate">{group.name}</span>
        <span className="ml-auto text-zinc-600 text-[10px]">
          {group.items.length}
        </span>
      </button>

      {isOpen && (
        <div className="flex flex-col">
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
                published: true
              })}
              className={cn(
                'flex items-center gap-2 w-full px-3 py-1 text-left text-xs hover:bg-eve-accent/20 rounded transition-colors',
                selectedItem?.typeId === item.typeId && 'bg-eve-accent/30 text-eve-accent'
              )}
              style={{ paddingLeft: '28px' }}
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
            {categories.map(category => (
              <CategoryNodeComponent
                key={category.id}
                category={category}
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