'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Bell, Mail, Zap, TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useTranslations } from '@/i18n/hooks'

export function NotificationsTab() {
  const { t } = useTranslations()

  const items = [
    { 
      key: 'email', 
      icon: Mail, 
      label: 'settings.notifications.email', 
      desc: 'settings.notifications.emailDesc',
      comingSoon: true 
    },
    { 
      key: 'skills', 
      icon: Zap, 
      label: 'settings.notifications.skills', 
      desc: 'settings.notifications.skillsDesc',
      comingSoon: true 
    },
    { 
      key: 'market', 
      icon: TrendingUp, 
      label: 'settings.notifications.market', 
      desc: 'settings.notifications.marketDesc',
      comingSoon: true 
    }
  ]

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
                <div className="flex items-center gap-3">
                  {item.comingSoon && (
                    <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-500 border-amber-500/20 px-1.5 py-0">
                      {t('settings.comingSoon')}
                    </Badge>
                  )}
                  <Switch disabled={item.comingSoon} checked={false} />
                </div>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
