import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import { DashboardShell } from '@/components/layout/dashboard-shell'

export default async function PublicProfileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  return (
    <DashboardShell>
      {children}
    </DashboardShell>
  )
}