import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { verifyJWT } from '@/lib/auth-jwt'
import { prisma } from '@/lib/prisma'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = cookies()
  const sessionToken = cookieStore.get('session')?.value

  if (!sessionToken) {
    redirect('/api/auth/signin')
  }

  const payload = await verifyJWT(sessionToken)
  if (!payload || !payload.userId) {
    redirect('/api/auth/signin')
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { role: true, id: true, name: true }
  })

  if (!user || user.role !== 'master') {
    // Log unauthorized access attempt
    await prisma.securityEvent.create({
      data: {
        event: 'UNAUTHORIZED_ADMIN_ACCESS',
        userId: payload.userId,
        details: {
          attemptedBy: user?.name || 'Unknown',
          path: '/dashboard/admin',
          timestamp: new Date().toISOString()
        }
      }
    })
    redirect('/dashboard')
  }

  return <>{children}</>
}
