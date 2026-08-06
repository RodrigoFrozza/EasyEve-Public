'use client'

import { createContext, useContext, type ReactNode } from 'react'

export type ActivityCardLayoutMode = 'compact' | 'expanded'

const ActivityCardLayoutContext = createContext<ActivityCardLayoutMode>('compact')

export function ActivityCardLayoutProvider({
  mode,
  children,
}: {
  mode: ActivityCardLayoutMode
  children: ReactNode
}) {
  return (
    <ActivityCardLayoutContext.Provider value={mode}>
      {children}
    </ActivityCardLayoutContext.Provider>
  )
}

export function useActivityCardLayoutMode(): ActivityCardLayoutMode {
  return useContext(ActivityCardLayoutContext)
}

/** Maps content displayMode (incl. legacy "tabs") to card shell layout */
export function toActivityCardLayoutMode(
  displayMode?: 'compact' | 'expanded' | 'tabs' | string
): ActivityCardLayoutMode {
  return displayMode === 'compact' ? 'compact' : 'expanded'
}
