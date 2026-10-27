import { AdminHubLanding } from '@/components/admin/shared/AdminHubLanding'
import { Activity, Terminal, CalendarClock, ScrollText } from 'lucide-react'

export default function AdminSystemPage() {
  return (
    <AdminHubLanding
      titleKey="admin.systemHub.title"
      descriptionKey="admin.systemHub.description"
      sections={[
        {
          labelKey: 'admin.nav.health',
          href: '/dashboard/admin/system/health',
          icon: Activity,
        },
        {
          labelKey: 'admin.nav.scripts',
          href: '/dashboard/admin/system/scripts',
          icon: Terminal,
        },
        {
          labelKey: 'admin.nav.schedules',
          href: '/dashboard/admin/system/schedules',
          icon: CalendarClock,
        },
        {
          labelKey: 'admin.nav.logs',
          href: '/dashboard/admin/system/logs',
          icon: ScrollText,
        },
      ]}
    />
  )
}
