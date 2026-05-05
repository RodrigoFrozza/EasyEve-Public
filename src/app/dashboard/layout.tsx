import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: 'noindex, nofollow',
}

import { getSession } from '@/lib/session'
import { DashboardShell } from '@/components/layout/dashboard-shell'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSession()

  if (!session) {
    redirect('/login')
  }

  if (session.user.isBlocked === true) {
    const reason = session.user.blockReason || 'Manual block'
    redirect(`/login?blocked=true&reason=${encodeURIComponent(reason)}`)
  }

  return (
    <DashboardShell>
      {children}
    </DashboardShell>
  )
}
