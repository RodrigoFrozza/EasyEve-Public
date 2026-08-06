'use client'

import Link from 'next/link'
import { Users, Crown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslations } from '@/i18n/hooks'

export function SettingsPageHeader() {
  const { t } = useTranslations()

  return (
    <header className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-white">{t('settings.title')}</h1>
        <p className="mt-1 text-gray-400">{t('settings.pageSubtitle')}</p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-eve-border hover:bg-eve-accent/10 hover:text-eve-accent"
          asChild
        >
          <Link href="/dashboard/characters">
            <Users className="h-4 w-4" />
            {t('settings.quickCharacters')}
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-eve-border hover:bg-eve-accent/10 hover:text-eve-accent"
          asChild
        >
          <Link href="/dashboard/subscription">
            <Crown className="h-4 w-4" />
            {t('settings.quickSubscription')}
          </Link>
        </Button>
      </div>
    </header>
  )
}
