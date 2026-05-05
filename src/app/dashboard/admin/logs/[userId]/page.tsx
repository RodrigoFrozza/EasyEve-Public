'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { UserLogsV2 } from '@/components/admin/system/UserLogsV2'

export default function UserLogsPage() {
  const { userId } = useParams()
  const [userName, setUserName] = useState<string>('')

  const fetchUserInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/accounts?summary=1')
      if (res.ok) {
        const data = await res.json()
        const user = data.accounts?.find((a: any) => a.id === userId)
        if (user) setUserName(user.name || user.accountCode || userId as string)
      }
    } catch (err) {}
  }, [userId])

  useEffect(() => {
    fetchUserInfo()
  }, [fetchUserInfo])

  return (
    <UserLogsV2 userId={userId as string} userName={userName} />
  )
}
