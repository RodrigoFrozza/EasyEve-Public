'use client'

import { User, Users, Crown, Globe, Lock } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { isPremium } from '@/lib/utils'
import { CharacterSummaryStat } from '@/components/characters/CharacterSummaryStat'
import type { SettingsUser } from './settings-types'

const LOCALE_LABELS: Record<string, string> = {
  en: 'EN',
  'pt-BR': 'PT',
  zh: 'ZH',
  ja: 'JA',
  ko: 'KO',
}

interface SettingsStatusStripProps {
  user: SettingsUser
}

export function SettingsStatusStrip({ user }: SettingsStatusStripProps) {
  const { t } = useTranslations()

  const mainCharacter =
    user.characters.find((c) => c.isMain) ?? user.characters[0] ?? null
  const characterCount = user.characters.length
  const premiumActive = isPremium(user.subscriptionEnd)
  const isExpired =
    !!user.subscriptionEnd && new Date(user.subscriptionEnd) < new Date()
  const isPublic = user.profile?.isPublic ?? true
  const locale = user.profile?.locale

  const premiumValue = premiumActive
    ? t('subscription.active')
    : isExpired
      ? t('subscription.statusExpired')
      : t('subscription.statusInactive')

  const profileValue = isPublic
    ? t('settings.privacy.profilePublic')
    : t('settings.privacy.profilePrivate')

  const localeHint = locale ? LOCALE_LABELS[locale] ?? locale : undefined

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <CharacterSummaryStat
        title={t('settings.statusMain')}
        value={mainCharacter?.name ?? t('settings.capsuleer')}
        hint={
          mainCharacter
            ? t('settings.linkedCharactersCount', { count: characterCount })
            : t('settings.statusNoCharacters')
        }
        icon={User}
        variant="cyan"
      />
      <CharacterSummaryStat
        title={t('settings.statusCharacters')}
        value={String(characterCount)}
        hint={t('settings.statusCharactersHint')}
        icon={Users}
        variant="blue"
      />
      <CharacterSummaryStat
        title={t('settings.statusPremium')}
        value={premiumValue}
        hint={premiumActive ? t('settings.statusPremiumActiveHint') : t('settings.statusPremiumInactiveHint')}
        icon={Crown}
        variant="amber"
      />
      <CharacterSummaryStat
        title={t('settings.statusProfile')}
        value={profileValue}
        hint={localeHint ? `${t('settings.statusLocaleHint')}: ${localeHint}` : undefined}
        icon={isPublic ? Globe : Lock}
        variant="emerald"
      />
    </div>
  )
}
