'use client'

import { useState, useEffect } from 'react'
import { Bell, Mail, Zap, BarChart } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { toast } from 'sonner'
import { SettingsSectionCard } from './SettingsSectionCard'
import { SettingsToggleRow } from './SettingsToggleRow'

interface NotificationItem {
  key: string
  icon: typeof Mail
  labelKey: string
  descKey: string
  enabled: boolean
  disabled?: boolean
}

export function NotificationsTab() {
  const { t } = useTranslations()
  const [items, setItems] = useState<NotificationItem[]>([
    {
      key: 'email',
      icon: Mail,
      labelKey: 'settings.notifications.email',
      descKey: 'settings.notifications.emailDesc',
      enabled: true,
    },
    {
      key: 'skills',
      icon: Zap,
      labelKey: 'settings.notifications.skills',
      descKey: 'settings.notifications.skillsDesc',
      enabled: false,
    },
    {
      key: 'market',
      icon: BarChart,
      labelKey: 'settings.notifications.market',
      descKey: 'settings.notifications.marketDesc',
      enabled: false,
      disabled: true,
    },
  ])
  const [loading, setLoading] = useState(true)
  const [savingKey, setSavingKey] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings/preferences')
      .then((res) => res.json())
      .then((data) => {
        setItems((prev) =>
          prev.map((item) => ({
            ...item,
            enabled:
              data[`notification${item.key.charAt(0).toUpperCase() + item.key.slice(1)}`] ??
              item.enabled,
          }))
        )
      })
      .catch((err) => console.error('Failed to load notification settings', err))
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (key: string, enabled: boolean) => {
    const fieldMap: Record<string, string> = {
      email: 'notificationEmail',
      skills: 'notificationSkills',
      market: 'notificationMarket',
    }

    setSavingKey(key)
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, enabled } : item)))

    try {
      const res = await fetch('/api/settings/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldMap[key]]: enabled }),
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success(t('settings.notifications.saved'))
    } catch {
      setItems((prev) =>
        prev.map((item) => (item.key === key ? { ...item, enabled: !enabled } : item))
      )
      toast.error(t('settings.notifications.saveError'))
    } finally {
      setSavingKey(null)
    }
  }

  if (loading) {
    return <SettingsSectionCard title="" loading />
  }

  return (
    <SettingsSectionCard
      title={t('settings.notifications.title')}
      description={t('settings.notifications.desc')}
      icon={Bell}
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <SettingsToggleRow
            key={item.key}
            icon={Icon}
            label={t(item.labelKey)}
            description={t(item.descKey)}
            checked={item.enabled}
            onCheckedChange={(checked) => handleToggle(item.key, checked)}
            disabled={item.disabled}
            saving={savingKey === item.key}
            badge={item.disabled ? t('settings.comingSoon') : undefined}
          />
        )
      })}
    </SettingsSectionCard>
  )
}
