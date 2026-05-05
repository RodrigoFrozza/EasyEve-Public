import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { getCurrentUser } from '@/lib/api-helpers'
import { prisma } from '@/lib/prisma'
import { isPremium } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const SUBSCRIPTION_COST_ISK = 100_000_000 // 100 million ISK
const SUBSCRIPTION_DAYS = 30

type SubscribeTxResult =
  | { status: 'not_found' }
  | { status: 'insufficient'; current: number }
  | {
      status: 'success'
      subscriptionEnd: Date
      remainingBalance: number
    }

export async function POST() {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const reference = `subscription_${Date.now()}`

    const result = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw(
          Prisma.sql`SELECT id FROM "User" WHERE id = ${user.id} FOR UPDATE`
        )

        const row = await tx.user.findUnique({
          where: { id: user.id },
          select: { iskBalance: true, subscriptionEnd: true },
        })

        if (!row) {
          return { status: 'not_found' } satisfies SubscribeTxResult
        }

        if (row.iskBalance < SUBSCRIPTION_COST_ISK) {
          return {
            status: 'insufficient',
            current: row.iskBalance,
          } satisfies SubscribeTxResult
        }

        const now = new Date()
        const baseDate =
          row.subscriptionEnd && isPremium(row.subscriptionEnd)
            ? new Date(row.subscriptionEnd)
            : now

        const newSubscriptionEnd = new Date(
          baseDate.getTime() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000
        )
        const remainingBalance = row.iskBalance - SUBSCRIPTION_COST_ISK

        await tx.user.update({
          where: { id: user.id },
          data: {
            iskBalance: { decrement: SUBSCRIPTION_COST_ISK },
            subscriptionEnd: newSubscriptionEnd,
          },
        })

        await tx.iskHistory.create({
          data: {
            userId: user.id,
            amount: -SUBSCRIPTION_COST_ISK,
            type: 'subscription',
            reference,
          },
        })

        return {
          status: 'success',
          subscriptionEnd: newSubscriptionEnd,
          remainingBalance,
        } satisfies SubscribeTxResult
      },
      { maxWait: 5000, timeout: 10000 }
    )

    if (result.status === 'not_found') {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (result.status === 'insufficient') {
      return NextResponse.json(
        {
          error: 'Insufficient balance',
          current: result.current,
          required: SUBSCRIPTION_COST_ISK,
        },
        { status: 400 }
      )
    }

    return NextResponse.json({
      success: true,
      subscriptionEnd: result.subscriptionEnd,
      iskSpent: SUBSCRIPTION_COST_ISK,
      remainingBalance: result.remainingBalance,
    })
  } catch (error: unknown) {
    console.error('[Subscribe] Error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}