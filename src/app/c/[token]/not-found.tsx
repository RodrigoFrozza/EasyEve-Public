import Link from 'next/link'
import { UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { getTranslations } from '@/i18n/server'

export default async function SharedProfileNotFound() {
  const { t } = await getTranslations()

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-eve-panel">
        <UserX className="h-8 w-8 text-zinc-500" />
      </div>
      <h1 className="text-xl font-semibold text-white">{t('characterProfile.public.notFoundTitle')}</h1>
      <p className="max-w-md text-sm text-zinc-400">{t('characterProfile.public.notFoundDescription')}</p>
      <Button asChild variant="outline" className="border-eve-border">
        <Link href="/">{t('characterProfile.public.backHome')}</Link>
      </Button>
    </div>
  )
}
