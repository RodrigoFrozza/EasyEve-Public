'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Bell, Mail, Zap, BarChart } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { toast } from 'sonner'

interface NotificationItem {
  key: string
  icon: React.ElementType
  label: string
  desc: string
  enabled: boolean
}

export function NotificationsTab() {
  const { t } = useTranslations()
  const [items, setItems] = useState<NotificationItem[]>([
    { key: 'email', icon: Mail, label: 'settings.notifications.email', desc: 'settings.notifications.emailDesc', enabled: true },
    { key: 'skills', icon: Zap, label: 'settings.notifications.skills', desc: 'settings.notifications.skillsDesc', enabled: false },
    { key: 'market', icon: BarChart, label: 'settings.notifications.market', desc: 'settings.notifications.marketDesc', enabled: false },
  ])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/settings/preferences')
      .then(res => res.json())
      .then(data => {
        setItems(prev => prev.map(item => ({
          ...item,
          enabled: data[`notification${item.key.charAt(0).toUpperCase() + item.key.slice(1)}`] ?? item.enabled
        })))
      })
      .catch(err => console.error('Failed to load notification settings', err))
      .finally(() => setLoading(false))
  }, [])

  const handleToggle = async (key: string, enabled: boolean) => {
    const fieldMap: Record<string, string> = {
      email: 'notificationEmail',
      skills: 'notificationSkills',
      market: 'notificationMarket',
    }
    
    setItems(prev => prev.map(item => item.key === key ? { ...item, enabled } : item))
    
    try {
      const res = await fetch('/api/settings/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [fieldMap[key]]: enabled })
      })
      if (!res.ok) throw new Error('Failed to save')
      toast.success(t('settings.notifications.saved'))
    } catch {
      setItems(prev => prev.map(item => item.key === key ? { ...item, enabled: !enabled } : item))
      toast.error(t('settings.notifications.saveError'))
    }
  }

  if (loading) return <div className="text-gray-400">{t('global.loading')}</div>

  return (
    <div className="space-y-6">
      <Card className="bg-eve-panel/50 border-eve-border backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Bell className="h-5 w-5 text-eve-accent" />
            {t('settings.notifications.title')}
          </CardTitle>
          <CardDescription>{t('settings.notifications.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.key} className="flex items-center justify-between py-4 group">
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg bg-white/5 text-gray-400 group-hover:text-eve-accent transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{t(item.label)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{t(item.desc)}</p>
                  </div>
                </div>
                <Switch
                  checked={item.enabled}
                  onCheckedChange={(checked) => handleToggle(item.key, checked)}
                  aria-label={t(item.label)}
                  role="switch"
                />
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
