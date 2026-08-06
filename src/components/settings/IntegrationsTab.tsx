'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Link2,
  ShieldCheck,
  MessageSquare,
  Activity,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { SettingsSectionCard } from './SettingsSectionCard'
import type { SettingsIntegrationsMeta } from './settings-types'

interface IntegrationsTabProps {
  integrations: SettingsIntegrationsMeta
}

export function IntegrationsTab({ integrations }: IntegrationsTabProps) {
  const { t } = useTranslations()
  const { esiConnected, characterCount, lastSyncLabel } = integrations

  const services = [
    {
      id: 'esi',
      name: t('settings.integrations.esi'),
      desc: t('settings.integrations.esiDesc'),
      icon: ShieldCheck,
      connected: esiConnected,
      color: 'text-eve-accent',
      bg: 'bg-eve-accent/10',
      comingSoon: false,
      manageHref: '/dashboard/characters',
    },
    {
      id: 'discord',
      name: t('settings.integrations.discord'),
      desc: t('settings.integrations.discordDesc'),
      icon: MessageSquare,
      connected: false,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      comingSoon: true,
    },
    {
      id: 'zkill',
      name: t('settings.integrations.zkillboard'),
      desc: t('settings.integrations.zkillboardDesc'),
      icon: Activity,
      connected: false,
      color: 'text-red-500',
      bg: 'bg-red-500/10',
      comingSoon: true,
    },
  ] as const

  return (
    <SettingsSectionCard
      title={t('settings.integrations.title')}
      description={t('settings.integrations.desc')}
      icon={Link2}
      contentClassName="space-y-4"
    >
      {services.map((service) => {
        const Icon = service.icon
        return (
          <div
            key={service.id}
            className="group flex flex-col gap-3 rounded-xl border border-eve-border bg-white/5 p-4 transition-all hover:bg-white/[0.08] sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ${service.bg} ${service.color}`}
              >
                <Icon className="h-6 w-6" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h4 className="text-sm font-bold uppercase tracking-wide text-white">
                    {service.name}
                  </h4>
                  {service.comingSoon && (
                    <Badge
                      variant="outline"
                      className="border-zinc-600 text-[10px] uppercase tracking-wider text-zinc-400"
                    >
                      {t('settings.comingSoon')}
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-gray-500">{service.desc}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  {service.connected ? (
                    <div className="flex items-center gap-1.5 text-xs text-green-500">
                      <CheckCircle2 className="h-3 w-3" />
                      {t('settings.integrations.connected')}
                      {service.id === 'esi' && characterCount > 0 && (
                        <span className="text-gray-500">
                          · {t('settings.integrations.charactersLinked', { count: characterCount })}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <AlertCircle className="h-3 w-3" />
                      {t('settings.integrations.disconnected')}
                    </div>
                  )}
                  {service.id === 'esi' && lastSyncLabel && esiConnected && (
                    <span className="text-[10px] font-bold uppercase text-gray-600">
                      · {t('settings.integrations.lastSync', { time: lastSyncLabel })}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {service.comingSoon ? (
              <Button
                variant="outline"
                size="sm"
                disabled
                className="w-full shrink-0 border-eve-border text-gray-500 sm:w-auto"
              >
                {t('settings.integrations.connect')}
              </Button>
            ) : service.connected && 'manageHref' in service ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 border-eve-accent text-eve-accent hover:bg-eve-accent hover:text-black sm:w-auto"
                asChild
              >
                <Link href={service.manageHref}>
                  {t('settings.integrations.manage')}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 border-eve-accent text-eve-accent hover:bg-eve-accent hover:text-black sm:w-auto"
                asChild
              >
                <Link href="/dashboard/characters">
                  {t('settings.integrations.loginWithEsi')}
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </Button>
            )}
          </div>
        )
      })}
    </SettingsSectionCard>
  )
}
