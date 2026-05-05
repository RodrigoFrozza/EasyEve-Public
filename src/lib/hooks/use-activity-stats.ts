import { useMemo } from 'react'
import { ActivityEnhanced, isMiningActivity, isRattingActivity, isExplorationActivity, isAbyssalActivity, MiningActivityData, RattingActivityData, ExplorationActivityData, AbyssalActivityData } from '@/types/domain'
import { getActivityFinancialMetrics } from '@/lib/activities/activity-metrics'

export function useActivityStats(activity: ActivityEnhanced) {
  return useMemo(() => {
    const miningActivity = isMiningActivity(activity) ? activity : null
    const rattingActivity = isRattingActivity(activity) ? activity : null
    const explorationActivity = isExplorationActivity(activity) ? activity : null
    const abyssalActivity = isAbyssalActivity(activity) ? activity : null
    
    const miningData = miningActivity?.data as MiningActivityData
    const rattingData = rattingActivity?.data as RattingActivityData
    const explorationData = explorationActivity?.data as ExplorationActivityData
    const abyssalData = abyssalActivity?.data as AbyssalActivityData
    
    // Stats calculation
    const miningTotalQuantity = miningData?.totalQuantity || 0
    const metrics = getActivityFinancialMetrics(activity)
    const miningTotalValue = metrics.miningValue
    const grossBounty = metrics.bounties + metrics.ess + metrics.additionalBounties
    
    const totalRevenue = metrics.gross
    const netProfit = metrics.net

    // Time calculation
    const start = new Date(activity.startTime).getTime()
    const end = activity.endTime ? new Date(activity.endTime).getTime() : Date.now()
    const hours = (end - start) / 3600000
    const efficiency = hours > 0.01 ? netProfit / hours : 0

    return {
      miningData,
      rattingData,
      explorationData,
      abyssalData,
      miningActivity,
      rattingActivity,
      explorationActivity,
      abyssalActivity,
      miningTotalQuantity,
      miningTotalValue,
      grossBounty,
      totalRevenue,
      netProfit,
      efficiency,
      isMining: !!miningActivity,
      isRatting: !!rattingActivity,
      isExploration: !!explorationActivity,
      isAbyssal: !!abyssalActivity,
      logs: (miningData?.logs || rattingData?.logs || explorationData?.logs || abyssalData?.logs || [])
    }
  }, [activity])
}
