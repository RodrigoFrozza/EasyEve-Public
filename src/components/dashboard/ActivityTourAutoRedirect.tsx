'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  getActivityTourStatus,
  isActivityTourPending,
  setActivityTourPending,
  isEligibleForFirstCharacterTour,
} from '@/lib/activity-tour/storage'

type ActivityTourAutoRedirectProps = {
  userId?: string | null
  characterCount: number
}

export function ActivityTourAutoRedirect({ userId, characterCount }: ActivityTourAutoRedirectProps) {
  const router = useRouter()

  useEffect(() => {
    if (!userId) return
    if (!isEligibleForFirstCharacterTour(characterCount)) return

    const status = getActivityTourStatus(userId)
    if (status !== 'never_seen') return

    const pending = isActivityTourPending(userId)
    if (!pending) {
      setActivityTourPending(true, userId)
    }

    router.replace('/dashboard/activity?type=ratting')
  }, [characterCount, router, userId])

  return null
}
