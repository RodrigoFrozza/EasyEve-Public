'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { Menu, ArrowLeft } from 'lucide-react'
import { useTranslations } from '@/i18n/hooks'
import { AdminStatusStrip } from '@/components/admin/shared/AdminStatusStrip'
import { ADMIN_BREADCRUMB_KEYS } from '@/constants/admin-navigation'
import { Button } from '@/components/ui/button'

export function AdminHeader({ onMenuClick }: { onMenuClick?: () => void }) {
  const pathname = usePathname()
  const { t } = useTranslations()

  const segments = pathname.split('/').filter(Boolean)
  const adminIndex = segments.indexOf('admin')
  const sectionKey =
    adminIndex >= 0 && segments[adminIndex + 1]
      ? ADMIN_BREADCRUMB_KEYS[segments[adminIndex + 1]]
      : 'admin.nav.overview'
  const pageTitle = sectionKey ? t(sectionKey) : t('admin.nav.overview')

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-white/[0.06] bg-[#05090f]/90 backdrop-blur px-4 lg:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="lg:hidden shrink-0"
          onClick={onMenuClick}
          aria-label={t('admin.nav.openMenu')}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold text-foreground truncate">{pageTitle}</h1>
      </div>

      <div className="flex items-center gap-4 shrink-0">
        <AdminStatusStrip />
        <Button variant="outline" size="sm" className="hidden sm:inline-flex gap-2" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('admin.nav.backToDashboard')}
          </Link>
        </Button>
      </div>
    </header>
  )
}
