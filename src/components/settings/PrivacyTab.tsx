'use client'

import { useState, useEffect } from 'react'
import {
  Lock,
  Globe,
  Shield,
  Swords,
  Trophy,
  Users,
  Layout,
  Zap,
  MapPin,
  Ship,
  Wallet,
} from 'lucide-react'
import { toast } from 'sonner'
import { useTranslations } from '@/i18n/hooks'
import { SettingsSectionCard } from './SettingsSectionCard'
import { SettingsToggleRow } from './SettingsToggleRow'

type PrivacyKey =
  | 'isPublic'
  | 'showKills'
  | 'showDeaths'
  | 'showReputation'
  | 'showMedals'
  | 'showActivities'
  | 'showFits'
  | 'showContacts'
  | 'showLocation'
  | 'showShip'
  | 'showWallet'

interface PrivacySettings {
  isPublic: boolean
  showKills: boolean
  showDeaths: boolean
  showReputation: boolean
  showMedals: boolean
  showActivities: boolean
  showFits: boolean
  showContacts: boolean
  showLocation: boolean
  showShip: boolean
  showWallet: boolean
}

const VISIBILITY_SECTION = {
  key: 'isPublic' as const,
  icon: Globe,
  labelKey: 'settings.privacy.profilePublic',
  privateLabelKey: 'settings.privacy.profilePrivate',
  descKey: 'settings.privacy.profilePublicDesc',
  privateDescKey: 'settings.privacy.profilePrivateDesc',
}

const DETAIL_SECTIONS: {
  key: Exclude<PrivacyKey, 'isPublic'>
  icon: typeof Swords
  labelKey: string
  iconClassName?: string
}[] = [
  { key: 'showKills', icon: Swords, labelKey: 'settings.privacy.showKills', iconClassName: 'text-red-500' },
  { key: 'showDeaths', icon: Zap, labelKey: 'settings.privacy.showDeaths', iconClassName: 'text-orange-500' },
  { key: 'showReputation', icon: Shield, labelKey: 'settings.privacy.showReputation', iconClassName: 'text-green-500' },
  { key: 'showMedals', icon: Trophy, labelKey: 'settings.privacy.showMedals', iconClassName: 'text-yellow-500' },
  { key: 'showActivities', icon: Layout, labelKey: 'settings.privacy.showActivities', iconClassName: 'text-purple-500' },
  { key: 'showFits', icon: Layout, labelKey: 'settings.privacy.showFits', iconClassName: 'text-cyan-500' },
  { key: 'showContacts', icon: Users, labelKey: 'settings.privacy.showContacts', iconClassName: 'text-pink-500' },
  { key: 'showLocation', icon: MapPin, labelKey: 'settings.privacy.showLocation', iconClassName: 'text-emerald-500' },
  { key: 'showShip', icon: Ship, labelKey: 'settings.privacy.showShip', iconClassName: 'text-amber-500' },
  { key: 'showWallet', icon: Wallet, labelKey: 'settings.privacy.showWallet', iconClassName: 'text-green-400' },
]

export function PrivacyTab() {
  const { t } = useTranslations()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<PrivacyKey | null>(null)
  const [settings, setSettings] = useState<PrivacySettings>({
    isPublic: true,
    showKills: true,
    showDeaths: true,
    showReputation: true,
    showMedals: true,
    showActivities: true,
    showFits: true,
    showContacts: true,
    showLocation: false,
    showShip: false,
    showWallet: true,
  })

  useEffect(() => {
    fetch('/api/players/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data) setSettings((prev) => ({ ...prev, ...data }))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (key: PrivacyKey, checked: boolean) => {
    setSaving(key)
    try {
      const newSettings = { ...settings, [key]: checked }
      const res = await fetch('/api/players/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings),
      })

      if (res.ok) {
        setSettings(newSettings)
        if (key === 'isPublic') {
          toast.success(
            checked ? t('settings.privacy.profileNowPublic') : t('settings.privacy.profileNowPrivate')
          )
        } else {
          toast.success(t('common.success'))
        }
      } else {
        throw new Error('Failed to save')
      }
    } catch (err) {
      console.error(err)
      toast.error(t('settings.privacy.errorSaving'))
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <SettingsSectionCard title="" loading />
        <SettingsSectionCard title="" loading />
      </div>
    )
  }

  const isPublic = settings.isPublic

  return (
    <div className="space-y-6">
      <SettingsSectionCard
        title={t('settings.privacy.visibilityTitle')}
        description={t('settings.privacy.visibilityDesc')}
        icon={Lock}
      >
        <SettingsToggleRow
          icon={isPublic ? Globe : Lock}
          iconClassName={isPublic ? 'text-blue-500' : 'text-gray-500'}
          label={t(isPublic ? VISIBILITY_SECTION.labelKey : VISIBILITY_SECTION.privateLabelKey)}
          description={t(isPublic ? VISIBILITY_SECTION.descKey : VISIBILITY_SECTION.privateDescKey)}
          checked={isPublic}
          onCheckedChange={(checked) => handleToggle('isPublic', checked)}
          saving={saving === 'isPublic'}
        />
      </SettingsSectionCard>

      <SettingsSectionCard
        title={t('settings.privacy.detailsTitle')}
        description={
          isPublic
            ? t('settings.privacy.detailsDesc')
            : t('settings.privacy.detailsDisabledWhenPrivate')
        }
        icon={Shield}
        contentClassName={!isPublic ? 'opacity-60' : undefined}
      >
        {DETAIL_SECTIONS.map((section) => {
          const Icon = section.icon
          return (
            <SettingsToggleRow
              key={section.key}
              icon={Icon}
              iconClassName={section.iconClassName}
              label={t(section.labelKey)}
              checked={settings[section.key]}
              onCheckedChange={(checked) => handleToggle(section.key, checked)}
              disabled={!isPublic}
              saving={saving === section.key}
            />
          )
        })}
      </SettingsSectionCard>
    </div>
  )
}
