'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User, Calendar, Crown, ExternalLink, Sparkles, Zap } from 'lucide-react'
import { AccountIdCard } from './AccountIdCard'
import { SettingsSectionCard } from './SettingsSectionCard'
import { SettingsToggleRow } from './SettingsToggleRow'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { useTranslations } from '@/i18n/hooks'
import Link from 'next/link'
import { toast } from 'sonner'
import type { SettingsUser } from './settings-types'

interface AccountTabProps {
  user: SettingsUser | null
  mainCharacter: {
    id: string
    name: string
    isMain: boolean
  } | null
}

export function AccountTab({ user, mainCharacter }: AccountTabProps) {
  const { t } = useTranslations()
  const [loading, setLoading] = useState(!user)
  const [autoTrackingEnabled, setAutoTrackingEnabled] = useState(true)
  const [autoTrackingLoading, setAutoTrackingLoading] = useState(true)
  const [autoTrackingSaving, setAutoTrackingSaving] = useState(false)

  useEffect(() => {
    if (user) setLoading(false)
  }, [user])

  useEffect(() => {
    fetch('/api/players/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.autoTrackingEnabled === 'boolean') {
          setAutoTrackingEnabled(data.autoTrackingEnabled)
        }
      })
      .catch(console.error)
      .finally(() => setAutoTrackingLoading(false))
  }, [])

  const handleAutoTrackingToggle = async (checked: boolean) => {
    setAutoTrackingSaving(true)
    try {
      const res = await fetch('/api/players/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoTrackingEnabled: checked }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setAutoTrackingEnabled(checked)
      toast.success(
        checked ? t('settings.autoTrackingEnabled') : t('settings.autoTrackingDisabled')
      )
    } catch {
      toast.error(t('settings.errorSaving'))
    } finally {
      setAutoTrackingSaving(false)
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

  return (
    <div className="space-y-6">
      <SettingsSectionCard
        title={t('settings.profile')}
        description={t('settings.profileDesc')}
        icon={User}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-20 w-20 border-2 border-eve-accent/20">
              <AvatarImage
                src={
                  mainCharacter
                    ? `https://images.evetech.net/characters/${mainCharacter.id}/portrait?size=128`
                    : ''
                }
              />
              <AvatarFallback className="bg-eve-dark text-xl text-eve-accent">
                {(mainCharacter?.name || 'U')[0]}
              </AvatarFallback>
            </Avatar>
            <div>
              <h3 className="text-xl font-bold leading-tight text-white">
                {mainCharacter?.name || t('settings.capsuleer')}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <p className="text-sm text-gray-400">
                  {t('settings.linkedCharactersCount', {
                    count: user?.characters?.length || 0,
                  })}
                </p>
                {user?.role === 'master' && (
                  <span className="rounded bg-eve-accent/20 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-eve-accent">
                    MASTER
                  </span>
                )}
              </div>
            </div>
          </div>
          <Link href="/dashboard/characters">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 border-eve-border hover:bg-eve-accent/10 hover:text-eve-accent"
            >
              {t('settings.manageCharacters')}
              <ExternalLink className="h-3 w-3" />
            </Button>
          </Link>
        </div>
      </SettingsSectionCard>

      <SettingsSectionCard title={t('settings.accountSectionTitle')} description={t('settings.accountSectionDesc')}>
        <div className="space-y-4">
          {user?.accountCode && (
            <AccountIdCard
              accountCode={user.accountCode}
              label={t('settings.accountId')}
              description={t('settings.accountIdDesc')}
            />
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1 rounded-lg border border-white/5 bg-white/5 p-3">
              <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                <Calendar className="h-3 w-3" />
                {t('global.lastLogin')}
              </div>
              <div className="text-sm text-white">
                <FormattedDate date={user?.lastLoginAt || new Date()} />
              </div>
            </div>

            {user?.subscriptionEnd && new Date(user.subscriptionEnd) > new Date() && (
              <div className="flex flex-col gap-1 rounded-lg border border-yellow-400/10 bg-yellow-400/5 p-3">
                <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-yellow-400/70">
                  <Crown className="h-3 w-3" />
                  {t('global.premiumUntil')}
                </div>
                <div className="text-sm font-medium text-yellow-400">
                  <FormattedDate date={user.subscriptionEnd} />
                </div>
              </div>
            )}
          </div>

          {!autoTrackingLoading && (
            <SettingsToggleRow
              icon={autoTrackingEnabled ? Sparkles : Zap}
              iconClassName={autoTrackingEnabled ? 'text-eve-accent' : undefined}
              label={t('settings.autoTracking')}
              description={t('settings.autoTrackingDesc')}
              checked={autoTrackingEnabled}
              onCheckedChange={handleAutoTrackingToggle}
              saving={autoTrackingSaving}
            />
          )}
        </div>
      </SettingsSectionCard>
    </div>
  )
}
