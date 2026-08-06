'use client'

import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { useCharacterTags } from '@/lib/hooks/use-character-tags'
import { CharacterTagEditor } from '@/components/character-actions/CharacterTagEditor'
import { CharacterTagBadge } from './CharacterTagBadge'
import {
  CHARACTER_TAG_QUICK_ADD,
  CHARACTER_TAG_TRANSLATION_KEYS,
  CHARACTER_TAG_STYLE,
} from '@/constants/character-tags'

interface CharacterTagsRowProps {
  characterId: number
  tags: string[]
  compact?: boolean
  showQuickAdd?: boolean
  showSectionLabel?: boolean
  className?: string
}

export function CharacterTagsRow({
  characterId,
  tags,
  compact = false,
  showQuickAdd = true,
  showSectionLabel = false,
  className,
}: CharacterTagsRowProps) {
  const { t } = useTranslations()
  const { tagSaving, updateTags, toggleTag } = useCharacterTags(characterId, tags)

  return (
    <div className={cn('space-y-1.5', className)}>
      {showSectionLabel && (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          {t('characters.tags.sectionLabel')}
        </p>
      )}
      <div className={cn('flex flex-wrap items-center gap-1.5', compact && 'gap-1')}>
        {tags.map((tag) => (
          <CharacterTagBadge
            key={tag}
            tag={tag}
            compact={compact}
            disabled={tagSaving}
            onRemove={() => void toggleTag(tag)}
          />
        ))}
        {showQuickAdd &&
          CHARACTER_TAG_QUICK_ADD.filter((preset) => !tags.includes(preset)).map((preset) => {
            const translationKey = CHARACTER_TAG_TRANSLATION_KEYS[preset]
            const style = CHARACTER_TAG_STYLE[preset]
            const Icon = style?.icon
            return (
              <button
                key={preset}
                type="button"
                disabled={tagSaving}
                onClick={() => void toggleTag(preset)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-0.5 text-[10px] transition-colors',
                  'border-zinc-700/80 text-zinc-500 hover:border-eve-accent/50 hover:bg-eve-accent/5 hover:text-eve-accent',
                  'disabled:pointer-events-none disabled:opacity-50'
                )}
                title={translationKey ? t(translationKey) : preset}
              >
                {Icon && <Icon className="h-2.5 w-2.5 opacity-70" />}
                <span className="max-w-[72px] truncate">{translationKey ? t(translationKey) : preset}</span>
              </button>
            )
          })}
        <CharacterTagEditor
          characterId={characterId}
          currentTags={tags}
          onTagsChange={updateTags}
          disabled={tagSaving}
          compact={compact}
        />
      </div>
    </div>
  )
}
