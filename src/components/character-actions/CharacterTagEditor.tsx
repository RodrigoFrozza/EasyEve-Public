'use client'

import * as React from 'react'
import { Plus, Check, X, Loader2, Tag as TagIcon, Search, type LucideIcon } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslations } from '@/i18n/hooks'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { 
  CHARACTER_ACTIVITY_TAGS, 
  CHARACTER_TAG_TRANSLATION_KEYS,
  CHARACTER_TAG_STYLE 
} from '@/constants/character-tags'

interface CharacterTagEditorProps {
  characterId: number
  currentTags: string[]
  onTagsChange: (newTags: string[]) => Promise<void>
  disabled?: boolean
}

export function CharacterTagEditor({
  characterId,
  currentTags,
  onTagsChange,
  disabled = false,
}: CharacterTagEditorProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const { t } = useTranslations()

  const toggleTag = async (tag: string) => {
    if (isSubmitting) return

    setIsSubmitting(true)
    const isSelected = currentTags.includes(tag)
    const newTags = isSelected
      ? currentTags.filter((t) => t !== tag)
      : [...currentTags, tag]

    try {
      await onTagsChange(newTags)
      if (!isSelected) {
        setSearchValue('')
      }
    } catch (error) {
      console.error('Failed to update tags:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateCustom = async () => {
    const trimmed = searchValue.trim()
    if (!trimmed || trimmed.length > 30) return

    // Support comma-separated tags
    if (trimmed.includes(',')) {
      const parts = trimmed.split(',').map(s => s.trim()).filter(s => s && s.length <= 30)
      const uniqueNew = parts.filter(p => !currentTags.includes(p))
      if (uniqueNew.length > 0) {
        setIsSubmitting(true)
        try {
          await onTagsChange([...currentTags, ...uniqueNew])
          setSearchValue('')
        } finally {
          setIsSubmitting(false)
        }
      }
      return
    }

    if (currentTags.includes(trimmed)) return
    await toggleTag(trimmed)
  }

  // Filter out canonical tags that are already selected
  const availablePresets = CHARACTER_ACTIVITY_TAGS.filter(
    (tag) => !currentTags.includes(tag)
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-6 w-6 p-0 rounded-full border-dashed border-zinc-700 hover:border-eve-accent hover:bg-eve-accent/10 transition-all hover:scale-110 active:scale-95"
          disabled={disabled || isSubmitting}
          title={t('characters.tags.addTag') || "Add Tag"}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0 bg-zinc-900 border-zinc-800 shadow-2xl" align="start">
        <Command className="bg-transparent" onKeyDown={(e) => {
          if (e.key === 'Enter' && searchValue) {
            handleCreateCustom()
          }
        }}>
          <div className="flex items-center border-b border-zinc-800 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput 
              placeholder={t('characters.tags.searchPlaceholder') || "Search or create tags..."} 
              value={searchValue}
              onValueChange={setSearchValue}
              className="h-10 border-0 focus:ring-0 bg-transparent text-sm"
            />
          </div>
          <CommandList className="max-h-[300px]">
            <CommandEmpty>
              <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                <TagIcon className="h-8 w-8 text-zinc-600 mb-1" />
                <p className="text-[11px] text-zinc-400 leading-tight">
                  {searchValue.length > 30 
                    ? "Tag too long (max 30)" 
                    : "Tip: Use commas to add multiple tags at once"}
                </p>
                {searchValue.trim().length > 0 && searchValue.trim().length <= 30 && (
                  <Button 
                    variant="eve" 
                    size="sm" 
                    className="mt-3 h-8 w-full text-[11px] font-bold"
                    onClick={handleCreateCustom}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Saving..." : `Create "${searchValue}"`}
                  </Button>
                )}
              </div>
            </CommandEmpty>
            
            <CommandGroup heading={t('characters.tags.suggestionsLabel')} className="px-2">
              <div className="grid grid-cols-1 gap-0.5 py-1">
                {CHARACTER_ACTIVITY_TAGS.map((tag) => {
                  const isSelected = currentTags.includes(tag)
                  const translationKey = CHARACTER_TAG_TRANSLATION_KEYS[tag]
                  const style = CHARACTER_TAG_STYLE[tag]
                  const Icon = style?.icon || TagIcon
                  
                  return (
                    <CommandItem
                      key={tag}
                      value={tag}
                      onSelect={() => toggleTag(tag)}
                      className={cn(
                        "flex items-center gap-2 cursor-pointer rounded-md px-2 py-2 transition-all",
                        isSelected 
                          ? "bg-eve-accent/10 text-eve-accent font-medium shadow-[inset_0_0_8px_rgba(234,179,8,0.05)]" 
                          : "hover:bg-white/5 text-zinc-400 hover:text-zinc-200"
                      )}
                    >
                      <div className={cn(
                        "flex items-center justify-center h-5 w-5 rounded-md transition-colors",
                        isSelected ? "bg-eve-accent/20" : "bg-zinc-800/50"
                      )}>
                        <Icon className={cn("h-3 w-3", 
                          isSelected ? "text-eve-accent" : (style?.iconClass || "text-zinc-500")
                        )} />
                      </div>
                      <span className="text-xs truncate flex-1">
                        {translationKey ? t(translationKey) : tag}
                      </span>
                      {isSelected && (
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-eve-accent text-zinc-950">
                          <Check className="h-2.5 w-2.5" />
                        </div>
                      )}
                    </CommandItem>
                  )
                })}
              </div>
            </CommandGroup>

            {currentTags.length > 0 && (
              <CommandGroup heading={t('characters.tags.selectedLabel')} className="px-2 pt-2 border-t border-zinc-800/50">
                <div className="flex flex-wrap gap-1 p-1">
                  {currentTags.map((tag) => {
                    const isCanonical = CHARACTER_ACTIVITY_TAGS.includes(tag as any)
                    const translationKey = isCanonical ? CHARACTER_TAG_TRANSLATION_KEYS[tag] : null
                    
                    return (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="bg-zinc-800 text-zinc-300 border-zinc-700 text-[10px] py-0 px-2 flex items-center gap-1 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30 cursor-pointer transition-all"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation()
                          toggleTag(tag)
                        }}
                      >
                        {translationKey ? t(translationKey) : tag}
                        <X className="h-2.5 w-2.5 ml-0.5 opacity-50" />
                      </Badge>
                    )
                  })}
                </div>
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
