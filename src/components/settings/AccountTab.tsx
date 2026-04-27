'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { User, Calendar, Crown, ExternalLink } from 'lucide-react'
import { AccountIdCard } from './AccountIdCard'
import { AutoTrackingToggle } from './AutoTrackingToggle'
import { FormattedDate } from '@/components/shared/FormattedDate'
import { useTranslations } from '@/i18n/hooks'
import Link from 'next/link'

interface AccountTabProps {
  user: any
  mainCharacter: any
}

export function AccountTab({ user, mainCharacter }: AccountTabProps) {
  const { t } = useTranslations()

  return (
    <div className="space-y-6">
      <Card className="bg-eve-panel/50 border-eve-border backdrop-blur-md">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <User className="h-5 w-5 text-eve-accent" />
            {t('settings.profile')}
          </CardTitle>
          <CardDescription>{t('settings.profileDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-20 w-20 border-2 border-eve-accent/20">
                <AvatarImage src={mainCharacter ? `https://images.evetech.net/characters/${mainCharacter.id}/portrait?size=128` : ''} />
                <AvatarFallback className="bg-eve-dark text-eve-accent text-xl">
                  {(mainCharacter?.name || 'U')[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-xl font-bold text-white leading-tight">{mainCharacter?.name || t('settings.capsuleer')}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-sm text-gray-400">
                    {t('settings.linkedCharactersCount', { count: user?.characters?.length || 0 })}
                  </p>
                  {user?.role === 'master' && (
                    <span className="text-[10px] bg-eve-accent/20 text-eve-accent px-1.5 py-0.5 rounded font-bold tracking-wider">MASTER</span>
                  )}
                </div>
              </div>
            </div>
            <Link href="/dashboard/characters">
              <Button variant="outline" size="sm" className="border-eve-border hover:bg-eve-accent/10 hover:text-eve-accent gap-2">
                {t('settings.manageCharacters')}
                <ExternalLink className="h-3 w-3" />
              </Button>
            </Link>
          </div>

          <Separator className="bg-eve-border/50" />

          <div className="grid gap-4 sm:grid-cols-2">
            {user?.accountCode && (
              <div className="sm:col-span-2">
                <AccountIdCard 
                  accountCode={user.accountCode}
                  label={t('settings.accountId')}
                  description={t('settings.accountIdDesc')}
                />
              </div>
            )}

            <div className="flex flex-col gap-1 p-3 rounded-lg bg-white/5 border border-white/5">
              <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wider font-medium">
                <Calendar className="h-3 w-3" />
                {t('global.lastLogin')}
              </div>
              <div className="text-sm text-white">
                <FormattedDate date={user?.lastLoginAt || new Date()} />
              </div>
            </div>

            {user?.subscriptionEnd && new Date(user.subscriptionEnd) > new Date() && (
              <div className="flex flex-col gap-1 p-3 rounded-lg bg-yellow-400/5 border border-yellow-400/10">
                <div className="flex items-center gap-2 text-xs text-yellow-400/70 uppercase tracking-wider font-medium">
                  <Crown className="h-3 w-3" />
                  {t('global.premiumUntil')}
                </div>
                <div className="text-sm text-yellow-400 font-medium">
                  <FormattedDate date={user.subscriptionEnd} />
                </div>
              </div>
            )}

            <AutoTrackingToggle />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
