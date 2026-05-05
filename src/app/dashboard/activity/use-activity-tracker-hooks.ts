'use client'

import { useEffect, useRef, type Dispatch, type SetStateAction } from 'react'
import type { Activity } from '@/lib/stores/activity-store'
import { ANOMALIES_BY_FACTION, getRattingAnomaliesBySpaceAndFaction } from '@/lib/constants/activity-data'

export function useActivityFitsModules(
  setUserFits: (fits: unknown[]) => void,
  setModuleConfigs: (configs: unknown[]) => void,
  hasPremium: boolean
) {
  useEffect(() => {
    if (hasPremium) {
      fetch('/api/fits')
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setUserFits(data)
        })
        .catch((err) => console.error('Failed to fetch fits:', err))
    }

    fetch('/api/modules/config')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setModuleConfigs(data)
      })
      .catch((err) => console.error('Failed to fetch module configs:', err))
    // Intentionally run once on mount (setState identities are stable).
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap
  }, [])
}

export function useActivityUrlTypeSync(
  typeParam: string | null | undefined,
  setNewActivity: Dispatch<SetStateAction<Partial<Activity>>>
) {
  useEffect(() => {
    if (typeParam) {
      setNewActivity((prev) => ({ ...prev, type: typeParam }))
    }
  }, [typeParam, setNewActivity])
}

export function useActivityTrackerLifecycle({
  typeParam,
  startPolling,
  stopPolling,
  startRattingAutoSync,
  stopRattingAutoSync,
  startMiningAutoSync,
  stopMiningAutoSync,
  startAbyssalAutoSync,
  stopAbyssalAutoSync,
  startExplorationAutoSync,
  stopExplorationAutoSync,
}: {
  typeParam: string | null | undefined
  startPolling: (type?: string, interval?: number, limit?: number) => void
  stopPolling: () => void
  startRattingAutoSync: (interval: number) => void
  stopRattingAutoSync: () => void
  startMiningAutoSync: (interval: number) => void
  stopMiningAutoSync: () => void
  startAbyssalAutoSync: (interval: number) => void
  stopAbyssalAutoSync: () => void
  startExplorationAutoSync: (interval: number) => void
  stopExplorationAutoSync: () => void
}) {
  useEffect(() => {
    startPolling(typeParam ?? undefined, 30000)

    startRattingAutoSync(240000)
    startMiningAutoSync(300000)
    startAbyssalAutoSync(360000)
    startExplorationAutoSync(420000)

    return () => {
      stopPolling()
      stopRattingAutoSync()
      stopMiningAutoSync()
      stopAbyssalAutoSync()
      stopExplorationAutoSync()
    }
  }, [
    typeParam,
    startPolling,
    stopPolling,
    startRattingAutoSync,
    stopRattingAutoSync,
    startMiningAutoSync,
    stopMiningAutoSync,
    startAbyssalAutoSync,
    stopAbyssalAutoSync,
    startExplorationAutoSync,
    stopExplorationAutoSync,
  ])
}

export function useOpenAbyssalConfigListener(
  setConfigActivityId: (id: string | null) => void
) {
  useEffect(() => {
    const handleOpenConfig = (e: Event) => {
      const detail = (e as CustomEvent<{ activityId?: string }>).detail
      if (detail?.activityId) {
        setConfigActivityId(detail.activityId)
      }
    }
    window.addEventListener('open-abyssal-config', handleOpenConfig as EventListener)
    return () => window.removeEventListener('open-abyssal-config', handleOpenConfig as EventListener)
  }, [setConfigActivityId])
}

export function useRattingAnomalies(
  newActivity: Partial<Activity>,
  setAnomalies: (rows: { id: string; name: string }[]) => void
) {
  const requestIdRef = useRef(0)

  useEffect(() => {
    if (newActivity.type !== 'ratting' || !newActivity.data?.npcFaction) {
      setAnomalies([])
      return
    }

    const myRequest = ++requestIdRef.current
    const controller = new AbortController()

    const faction = newActivity.data.npcFaction.split(' ')[0]
    const siteType = newActivity.data?.siteType || 'Combat Anomaly'
    const localAnomalies = getRattingAnomaliesBySpaceAndFaction(newActivity.space, newActivity.data?.npcFaction as string).map((n, i) => ({
      id: `space-faction-${i}`,
      name: n,
    }))

    fetch(
      `/api/sde/anomalies?faction=${encodeURIComponent(faction)}${siteType ? `&type=${encodeURIComponent(siteType)}` : ''}${newActivity.space ? `&space=${encodeURIComponent(newActivity.space)}` : ''}`,
      { signal: controller.signal }
    )
      .then((res) => res.json())
      .then((data) => {
        if (myRequest !== requestIdRef.current) return
        if (Array.isArray(data) && data.length > 0) {
          setAnomalies(data)
        } else if (localAnomalies.length > 0) {
          setAnomalies(localAnomalies)
        } else if (ANOMALIES_BY_FACTION[newActivity.data?.npcFaction as string]) {
          const factionData = ANOMALIES_BY_FACTION[newActivity.data?.npcFaction as string]
          const list = newActivity.space ? (factionData[newActivity.space] || []) : Object.values(factionData).flat()
          setAnomalies(
            list.map((n, i) => ({
              id: `static-${i}`,
              name: n,
            }))
          )
        }
      })
      .catch((err) => {
        if ((err as Error)?.name === 'AbortError') return
        console.error('Failed to fetch anomalies:', err)
        if (myRequest !== requestIdRef.current) return
        if (localAnomalies.length > 0) {
          setAnomalies(localAnomalies)
        } else if (newActivity.data?.npcFaction && ANOMALIES_BY_FACTION[newActivity.data.npcFaction]) {
          const factionData = ANOMALIES_BY_FACTION[newActivity.data.npcFaction]
          const list = newActivity.space ? (factionData[newActivity.space] || []) : Object.values(factionData).flat()
          setAnomalies(
            list.map((n, i) => ({
              id: `static-${i}`,
              name: n,
            }))
          )
        }
      })

    return () => {
      controller.abort()
    }
  }, [newActivity.data?.npcFaction, newActivity.data?.siteType, newActivity.space, newActivity.type, setAnomalies])
}
