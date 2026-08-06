'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useTranslations } from '@/i18n/hooks'
import { X } from 'lucide-react'
import {
  CHARACTER_TAG_TRANSLATION_KEYS,
  CHARACTER_TAG_STYLE,
} from '@/constants/character-tags'

interface CharacterTagBadgeProps {
  tag: string
  onRemove?: () => void
  compact?: boolean
  disabled?: boolean
}

export function CharacterTagBadge({
  tag,
  onRemove,
  compact = false,
  disabled = false,
}: CharacterTagBadgeProps) {
  const { t } = useTranslations()
  const translationKey = CHARACTER_TAG_TRANSLATION_KEYS[tag]
  const style = CHARACTER_TAG_STYLE[tag] || {
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    bg: 'bg-cyan-500/5',
  }
  const Icon = style?.icon

  return (
    <Badge
      variant="outline"
      className={cn(
        'group flex items-center gap-1 transition-all',
        compact ? 'text-[10px] pr-1' : 'text-[10px] pr-1 hover:scale-105',
        style?.border || 'border-zinc-700/50',
        style?.text || 'text-zinc-400',
        style?.bg || 'bg-zinc-800/30'
      )}
    >
      {Icon && <Icon className={compact ? 'h-2 w-2' : 'h-2.5 w-2.5'} />}
      {translationKey ? t(translationKey) : tag}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="rounded-full p-0.5 opacity-40 transition-opacity hover:bg-red-400/10 hover:text-red-400 group-hover:opacity-100 disabled:pointer-events-none"
          title={t('global.remove')}
          aria-label={t('global.remove')}
        >
          <X className={compact ? 'h-2 w-2' : 'h-2.5 w-2.5'} />
        </button>
      )}
    </Badge>
  )
}
