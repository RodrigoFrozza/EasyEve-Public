'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Link2, ShieldCheck, MessageSquare, Activity, CheckCircle2, AlertCircle } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'

export function IntegrationsTab() {
  const { t } = useTranslations()

  const services = [
    {
      id: 'esi',
      name: 'EVE Online ESI',
      desc: 'settings.integrations.esi',
      icon: ShieldCheck,
      connected: true,
      lastSync: '5 mins ago',
      color: 'text-eve-accent',
      bg: 'bg-eve-accent/10',
    },
    {
      id: 'discord',
      name: 'Discord',
      desc: 'settings.integrations.discord',
      icon: MessageSquare,
      connected: false,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
    },
    {
      id: 'zkill',
      name: 'zKillboard',
      desc: 'settings.integrations.zkill',
      icon: Activity,
      connected: false,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
    }
  ]

  return (
    <div className="space-y-6">
      <Card className="bg-eve-panel/50 border-eve-border backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Link2 className="h-5 w-5 text-eve-accent" />
            {t('settings.integrations.title')}
          </CardTitle>
          <CardDescription>{t('settings.integrations.desc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {services.map((service) => {
            const Icon = service.icon
            return (
              <div 
                key={service.id} 
                className="group relative flex items-center justify-between p-4 rounded-xl border border-eve-border bg-white/5 hover:bg-white/[0.08] transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${service.bg} ${service.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white tracking-wide uppercase">{service.name}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      {service.connected ? (
                        <div className="flex items-center gap-1.5 text-xs text-green-500">
                          <CheckCircle2 className="h-3 w-3" />
                          {t('settings.integrations.connected')}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                          <AlertCircle className="h-3 w-3" />
                          {t('settings.integrations.disconnected')}
                        </div>
                      )}
                      {service.lastSync && (
                         <span className="text-[10px] text-gray-600 uppercase font-bold">• {t('settings.integrations.lastSync', { time: service.lastSync })}</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <Button 
                  variant={service.connected ? "ghost" : "outline"} 
                  size="sm"
                  className={service.connected ? "text-gray-400 hover:text-white" : "border-eve-accent text-eve-accent hover:bg-eve-accent hover:text-black"}
                >
                  {service.connected ? t('settings.integrations.manage') : t('common.save')}
                </Button>
              </div>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
