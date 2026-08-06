import { AdminHubLanding } from '@/components/admin/shared/AdminHubLanding'
import { Image, Newspaper, Award } from 'lucide-react'

export default function AdminContentManagementPage() {
  return (
    <AdminHubLanding
      titleKey="admin.contentHub.title"
      descriptionKey="admin.contentHub.description"
      sections={[
        {
          labelKey: 'admin.nav.carousel',
          href: '/dashboard/admin/content/carousel',
          icon: Image,
        },
        {
          labelKey: 'admin.nav.news',
          href: '/dashboard/admin/content/news',
          icon: Newspaper,
        },
        {
          labelKey: 'admin.nav.medals',
          href: '/dashboard/admin/content/medals',
          icon: Award,
        },
      ]}
    />
  )
}
