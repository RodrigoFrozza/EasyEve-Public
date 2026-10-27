'use client'

import * as React from 'react'
import { Plus, Check, X, Loader2, Tag as TagIcon, Search, type LucideIcon } from 'lucide-react'
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
  CHARACTER_TAG_STYLE,
} from '@/constants/character-tags'

interface CharacterTagEditorProps {
  characterId: number
  currentTags: string[]
  onTagsChange: (newTags: string[]) => Promise<void>
  disabled?: boolean
  compact?: boolean
}

export function CharacterTagEditor({
  characterId,
  currentTags,
  onTagsChange,
  disabled = false,
  compact = false,
}: CharacterTagEditorProps) {
  const [open, setOpen] = React.useState(false)
  const [searchValue, setSearchValue] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const { t } = useTranslations()

  const toggleTag = async (tag: string) => {
    if (isSubmitting || disabled) return

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

    if (trimmed.includes(',')) {
      const parts = trimmed
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s && s.length <= 30)
      const uniqueNew = parts.filter((p) => !currentTags.includes(p))
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

  const availablePresets = CHARACTER_ACTIVITY_TAGS.filter((tag) => !currentTags.includes(tag))

  const searchLower = searchValue.trim().toLowerCase()
  const filteredAvailablePresets = availablePresets.filter((tag) => {
    if (!searchLower) return true
    const translationKey = CHARACTER_TAG_TRANSLATION_KEYS[tag]
    const label = translationKey ? t(translationKey) : tag
    return tag.toLowerCase().includes(searchLower) || label.toLowerCase().includes(searchLower)
  })

  const popoverId = `character-tag-editor-${characterId}`

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            'rounded-full border-dashed border-zinc-700 p-0 transition-all hover:border-eve-accent hover:bg-eve-accent/10 hover:scale-110 active:scale-95',
            compact ? 'h-5 w-5' : 'h-6 w-6'
          )}
          disabled={disabled || isSubmitting}
          title={t('characters.tags.addTag')}
          aria-label={t('characters.tags.addTag')}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={popoverId}
        >
          <Plus className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        id={popoverId}
        className="w-[280px] border-zinc-800 bg-zinc-900 p-0 shadow-2xl sm:w-[320px]"
        align="start"
      >
        <Command
          className="bg-transparent"
          shouldFilter={false}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && searchValue) {
              e.preventDefault()
              void handleCreateCustom()
            }
          }}
        >
          <div className="flex items-center border-b border-zinc-800 px-3">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              placeholder={t('characters.tags.searchPlaceholder')}
              value={searchValue}
              onValueChange={setSearchValue}
              className="h-10 border-0 bg-transparent text-sm focus:ring-0"
            />
          </div>
          <CommandList className="max-h-[300px]">
            <CommandEmpty>
              <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                <TagIcon className="mb-1 h-8 w-8 text-zinc-600" />
                <p className="text-[11px] leading-tight text-zinc-400">
                  {searchValue.length > 30
                    ? t('characters.tags.tooLong')
                    : t('characters.tags.commaTip')}
                </p>
                {searchValue.trim().length > 0 && searchValue.trim().length <= 30 && (
                  <Button
                    variant="eve"
                    size="sm"
                    className="mt-3 h-8 w-full text-[11px] font-bold"
                    onClick={() => void handleCreateCustom()}
                    disabled={isSubmitting}
                  >
                    {isSubmitting
                      ? t('characters.tags.saving')
                      : t('characters.tags.createNamed', { name: searchValue.trim() })}
                  </Button>
                )}
              </div>
            </CommandEmpty>

            {filteredAvailablePresets.length > 0 && (
              <CommandGroup heading={t('characters.tags.suggestionsLabel')} className="px-2">
                <div className="grid grid-cols-1 gap-0.5 py-1">
                  {filteredAvailablePresets.map((tag) => {
                    const translationKey = CHARACTER_TAG_TRANSLATION_KEYS[tag]
                    const style = CHARACTER_TAG_STYLE[tag]
                    const Icon = style?.icon || TagIcon

                    return (
                      <CommandItem
                        key={tag}
                        value={tag}
                        onSelect={() => void toggleTag(tag)}
                        className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-zinc-400 transition-all hover:bg-white/5 hover:text-zinc-200"
                      >
                        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-zinc-800/50">
                          <Icon className={cn('h-3 w-3', style?.iconClass || 'text-zinc-500')} />
                        </div>
                        <span className="flex-1 truncate text-xs">
                          {translationKey ? t(translationKey) : tag}
                        </span>
                      </CommandItem>
                    )
                  })}
                </div>
              </CommandGroup>
            )}

            {currentTags.length > 0 && (
              <CommandGroup
                heading={t('characters.tags.selectedLabel')}
                className="border-t border-zinc-800/50 px-2 pt-2"
              >
                <div className="flex flex-wrap gap-1 p-1">
                  {currentTags.map((tag) => {
                    const isCanonical = CHARACTER_ACTIVITY_TAGS.includes(tag as (typeof CHARACTER_ACTIVITY_TAGS)[number])
                    const translationKey = isCanonical ? CHARACTER_TAG_TRANSLATION_KEYS[tag] : null
                    const style = CHARACTER_TAG_STYLE[tag]
                    const Icon = style?.icon || TagIcon

                    return (
                      <Badge
                        key={tag}
                        variant="secondary"
                        className="flex cursor-pointer items-center gap-1 border-zinc-700 bg-zinc-800 py-0 pl-2 pr-1 text-[10px] text-zinc-300 transition-all hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
                        onClick={(e: React.MouseEvent) => {
                          e.stopPropagation()
                          void toggleTag(tag)
                        }}
                      >
                        {Icon && <Icon className="h-2.5 w-2.5" />}
                        {translationKey ? t(translationKey) : tag}
                        <Check className="ml-0.5 h-2.5 w-2.5 text-eve-accent" />
                        <X className="h-2.5 w-2.5 opacity-50" />
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
