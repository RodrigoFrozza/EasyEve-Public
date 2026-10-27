import type { McpTool } from '../types'
import { listActivities, listPiAlerts } from './activities'
import { listFeatureFlags, listNews, listPromoBanners } from './content'
import { listPayments, paymentSyncStatus } from './payments'
import {
  envInfo,
  listDebugLogs,
  listScriptExecutions,
  listSecurityEvents,
  overviewStats,
  schedulerStatus,
  systemHealth,
} from './system'
import { characterTokenHealth, findUsers, getUser } from './users'
import { deleteOrphanUser, repairRattingProgress, setFeatureFlag, setNewsPublished, setPromoBannerActive, setScheduleActive } from './writes'

const ALL_TOOLS: McpTool[] = [
  envInfo,
  overviewStats,
  findUsers,
  getUser,
  characterTokenHealth,
  listPayments,
  paymentSyncStatus,
  listActivities,
  listPiAlerts,
  schedulerStatus,
  systemHealth,
  listScriptExecutions,
  listDebugLogs,
  listSecurityEvents,
  listFeatureFlags,
  listNews,
  listPromoBanners,
  setFeatureFlag,
  setScheduleActive,
  setNewsPublished,
  setPromoBannerActive,
  deleteOrphanUser,
  repairRattingProgress,
] as McpTool[]

export const MCP_TOOLS = new Map(ALL_TOOLS.map((tool) => [tool.name, tool]))
