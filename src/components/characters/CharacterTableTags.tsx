'use client'

import { useTranslations } from '@/i18n/hooks'
import {
  CHARACTER_TAG_TRANSLATION_KEYS,
  getCharacterTagColor,
} from '@/constants/character-tags'

/**
 * Display-only tag pills for the dense Characters table (Teal Aurora).
 * Shows at most 2 tags and collapses the rest into a non-shrinking "+N" pill
 * whose title lists the remainder; the leading pill truncates rather than
 * clipping the counter. Colors follow the activity → color map.
 */
export function CharacterTableTags({ tags }: { tags: string[] }) {
  const { t } = useTranslations()

  if (!tags || tags.length === 0) {
    return <span className="text-[11px] text-ta-faint">—</span>
  }

  const label = (tag: string) => {
    const key = CHARACTER_TAG_TRANSLATION_KEYS[tag]
    return key ? t(key) : tag
  }

  const nShown = tags.length > 2 ? 1 : Math.min(2, tags.length)
  const shown = tags.slice(0, nShown)
  const extra = tags.length - nShown

  return (
    <div className="flex min-w-0 items-center gap-[5px] overflow-hidden">
      {shown.map((tag) => {
        const c = getCharacterTagColor(tag)
        return (
          <span
            key={tag}
            className="min-w-0 shrink truncate rounded-[6px] px-[7px] py-[2px] font-accent text-[10.5px] font-semibold"
            style={{
              color: c,
              background: `color-mix(in srgb, ${c} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${c} 28%, transparent)`,
            }}
          >
            {label(tag)}
          </span>
        )
      })}
      {extra > 0 && (
        <span
          className="shrink-0 rounded-[6px] border border-white/10 bg-ta-inset px-[6px] py-[2px] font-accent text-[10.5px] font-semibold text-ta-secondary"
          title={tags.slice(nShown).map(label).join(', ')}
        >
          +{extra}
        </span>
      )}
    </div>
  )
}
