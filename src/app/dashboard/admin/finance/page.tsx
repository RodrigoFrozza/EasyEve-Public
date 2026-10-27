import { AdminHubLanding } from '@/components/admin/shared/AdminHubLanding'
import { CreditCard, Box, Megaphone, Image } from 'lucide-react'

export default function AdminFinancePage() {
  return (
    <AdminHubLanding
      titleKey="admin.financeHub.title"
      descriptionKey="admin.financeHub.description"
      sections={[
        {
          labelKey: 'admin.nav.payments',
          href: '/dashboard/admin/finance/payments',
          icon: CreditCard,
        },
        {
          labelKey: 'admin.nav.modules',
          href: '/dashboard/admin/finance/module-prices',
          icon: Box,
        },
        {
          labelKey: 'admin.nav.campaigns',
          href: '/dashboard/admin/finance/campaigns',
          icon: Megaphone,
        },
        {
          labelKey: 'admin.nav.promoBanners',
          href: '/dashboard/admin/finance/promo-banners',
          icon: Image,
        },
      ]}
    />
  )
}
