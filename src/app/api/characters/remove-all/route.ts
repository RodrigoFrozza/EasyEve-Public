import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { withErrorHandling } from '@/lib/api-handler'

export const POST = withErrorHandling(async () => {
  const session = await getSession()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Delete all characters for this user
  const deleteResult = await prisma.character.deleteMany({
    where: {
      userId: session.user.id
    }
  })

  return NextResponse.json({ 
    success: true, 
    count: deleteResult.count 
  })
})
