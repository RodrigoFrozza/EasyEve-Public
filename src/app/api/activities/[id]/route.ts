import { getCurrentUser } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { withErrorHandling } from '@/lib/api-handler'
import { AppError } from '@/lib/app-error'
import { ErrorCodes } from '@/lib/error-codes'
import { logger } from '@/lib/server-logger'

export const dynamic = 'force-dynamic'

export const GET = withErrorHandling(async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const activity = await prisma.activity.findFirst({
    where: {
      id: params.id,
      userId: user.id
    }
  })

  if (!activity) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Activity not found', 404)
  }

  return activity
})

export const PATCH = withErrorHandling(async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const user = await getCurrentUser()
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const body = await request.json()
  const { status, endTime, data, space, participants, isPaused, pausedAt, accumulatedPausedTime } = body

  const existingActivity = await prisma.activity.findFirst({
    where: { id: params.id, userId: user.id }
  })

  if (!existingActivity) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Activity not found', 404)
  }

  // If MTU or Salvage loot is updated, appraise it on the server
  let updatedData = { ...((existingActivity.data as any) || {}) }
  if (data) {
    updatedData = { ...updatedData, ...data }
  }

  if (data && (data.mtuContents || data.salvageContents)) {
    const allLootLines: { name: string, quantity: number, category: 'mtu' | 'salvage', mtuIndex?: number }[] = []
    const mtuItems: { [index: number]: { name: string, quantity: number }[] } = {}
    
    if (data.mtuContents && Array.isArray(data.mtuContents)) {
      data.mtuContents.forEach((mtu: any, mtuIdx: number) => {
        const items: Array<{ name: string; quantity: number }> = []
        const lootLines = (mtu.loot || '').split('\n')
        lootLines.forEach((line: string) => {
          const parts = line.split('\t')
          const name = parts[0]?.trim()
          const quantity = parseInt(parts[1]?.replace(/,/g, '') || '1')
          if (name && name.length > 1 && !isNaN(quantity)) {
            allLootLines.push({ name, quantity, category: 'mtu', mtuIndex: mtuIdx })
            items.push({ name, quantity })
          }
        })
        mtuItems[mtuIdx] = items
      })
    }

    const salvageItems: { name: string, quantity: number }[] = []
    if (data.salvageContents && Array.isArray(data.salvageContents)) {
      data.salvageContents.forEach((salvage: any) => {
        (salvage.loot || '').split('\n').forEach((line: string) => {
          const parts = line.split('\t')
          const name = parts[0]?.trim()
          const quantity = parseInt(parts[1]?.replace(/,/g, '') || '1')
          if (name && name.length > 1 && !isNaN(quantity)) {
            allLootLines.push({ name, quantity, category: 'salvage' })
            salvageItems.push({ name, quantity })
          }
        })
      })
    }

    if (allLootLines.length > 0) {
      const { getMarketAppraisal } = await import('@/lib/market')
      const uniqueNames = Array.from(new Set(allLootLines.map(l => l.name)))
      const prices = await getMarketAppraisal(uniqueNames)
      
      let mtuTotal = 0
      let salvageTotal = 0
      
      // Calculate individual MTU values
      const mtuValues: number[] = []
      if (data.mtuContents && Array.isArray(data.mtuContents)) {
        data.mtuContents.forEach((_: any, mtuIdx: number) => {
          let mtuValue = 0
          const items = mtuItems[mtuIdx] || []
          items.forEach(item => {
            const price = prices[item.name.toLowerCase()] || 0
            mtuValue += price * item.quantity
          })
          mtuValues.push(mtuValue)
          mtuTotal += mtuValue
        })
      }
      
      // Calculate salvage total
      salvageItems.forEach(item => {
        const price = prices[item.name.toLowerCase()] || 0
        salvageTotal += price * item.quantity
      })

      updatedData = {
        ...updatedData,
        estimatedLootValue: mtuTotal,
        estimatedSalvageValue: salvageTotal,
        mtuValues: mtuValues,
        lootAppraisedAt: new Date().toISOString(),
        totalItemCount: allLootLines.length
      }
    } else {
      updatedData = {
        ...updatedData,
        estimatedLootValue: 0,
        estimatedSalvageValue: 0,
        mtuValues: [],
        lootAppraisedAt: new Date().toISOString(),
        totalItemCount: 0
      }
    }
  }

  const activity = await prisma.activity.update({
    where: { id: params.id },
    data: {
      ...(status && { status }),
      ...(endTime && { endTime: new Date(endTime) }),
      ...(space && { space }),
      data: updatedData,
      ...(participants && { participants }),
      ...(typeof isPaused === 'boolean' && { isPaused }),
      ...(pausedAt !== undefined && { pausedAt: pausedAt ? new Date(pausedAt) : null }),
      ...(accumulatedPausedTime !== undefined && { accumulatedPausedTime })
    }
  })

  return activity
})

export const PUT = withErrorHandling(async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const body = await request.json()
  const { status, endTime } = body

  const existingActivity = await prisma.activity.findFirst({
    where: {
      id: params.id,
      userId: user.id
    }
  })

  if (!existingActivity) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Activity not found', 404)
  }

  const activity = await prisma.activity.update({
    where: { id: params.id },
    data: {
      ...(status && { status }),
      ...(endTime && { endTime: new Date(endTime) })
    }
  })

  return activity
})

export const DELETE = withErrorHandling(async (
  request: Request,
  { params }: { params: { id: string } }
) => {
  const user = await getCurrentUser()
  
  if (!user) {
    throw new AppError(ErrorCodes.API_UNAUTHORIZED, 'Unauthorized', 401)
  }

  const existingActivity = await prisma.activity.findFirst({
    where: {
      id: params.id,
      userId: user.id
    }
  })

  if (!existingActivity) {
    throw new AppError(ErrorCodes.API_NOT_FOUND, 'Activity not found', 404)
  }

  await prisma.activity.update({
    where: { id: params.id },
    data: { isDeleted: true }
  })

  return { success: true }
})