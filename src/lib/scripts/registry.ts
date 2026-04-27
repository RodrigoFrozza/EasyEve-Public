import { CleanupExecutionsHandler } from '../../../scripts/admin/handlers/cleanupExecutions'
import { AuditSecurityEventsHandler } from '../../../scripts/admin/handlers/auditSecurityEvents'
import { AuditSubscriptionsHandler } from '../../../scripts/admin/handlers/auditSubscriptions'
import { SyncWalletJournalHandler } from '../../../scripts/admin/handlers/syncWalletJournal'
import { SystemHealthCheckHandler } from '../../../scripts/admin/handlers/systemHealthCheck'
import { ValidateDatabaseIntegrityHandler } from '../../../scripts/admin/handlers/validateDatabaseIntegrity'
import { SyncModuleDogmaFromEsiHandler } from '../../../scripts/admin/handlers/syncModuleDogmaFromEsi'
import { ActivityLootSyncHandler } from '../../../scripts/admin/handlers/activityLootSync'
import { RunCustomMemoScriptHandler } from '../../../scripts/admin/handlers/runCustomMemoScript'
import { QueryShipsHandler } from '../../../scripts/admin/handlers/queryShips'
import { QueryCharactersHandler } from '../../../scripts/admin/handlers/queryCharacters'
import { QueryActivitiesHandler } from '../../../scripts/admin/handlers/queryActivities'
import { QueryModulesHandler } from '../../../scripts/admin/handlers/queryModules'
import { QueryFitsHandler } from '../../../scripts/admin/handlers/queryFits'
import { QueryUsersHandler } from '../../../scripts/admin/handlers/queryUsers'
import { QueryPaymentsHandler } from '../../../scripts/admin/handlers/queryPayments'
import { AuditActivitySafetyHandler } from '../../../scripts/admin/handlers/auditActivitySafety'
import { ActivityBackgroundSyncHandler } from '../../../scripts/admin/handlers/activityBackgroundSync'

import type { ScriptContext, ScriptHandler } from './script-context'

export type { ScriptContext, ScriptHandler } from './script-context'

export interface ScriptDefinition {
  id: string
  name: string
  description: string
  category:
    | 'operations'
    | 'security'
    | 'wallet'
    | 'database'
    | 'fitting'
    | 'custom'
  dangerLevel?: 'safe' | 'warning' | 'danger'
  deprecated?: boolean
  deprecatedReason?: string
  paramsSchema?: ScriptParamDefinition[]
  supportsDryRun?: boolean
  executionPolicy?: 'standard' | 'elevated'
  handler: ScriptHandler
}

export type ScriptParamDefinition = {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'json' | 'textarea'
  required?: boolean
  defaultValue?: string | number | boolean | Record<string, unknown> | unknown[]
  placeholder?: string
  description?: string
}

function validateAndNormalizeParams(
  schema: ScriptParamDefinition[] | undefined,
  incoming: Record<string, unknown>
): { ok: true; params: Record<string, unknown> } | { ok: false; errors: string[] } {
  if (!schema || schema.length === 0) return { ok: true, params: incoming }
  const errors: string[] = []
  const out: Record<string, unknown> = {}
  for (const def of schema) {
    const raw = incoming[def.key]
    const value = raw === undefined ? def.defaultValue : raw
    if (def.required && (value === undefined || value === null || value === '')) {
      errors.push(`Missing required param: ${def.key}`)
      continue
    }
    if (value === undefined) continue
    if (def.type === 'number') {
      const num = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(num)) {
        errors.push(`Param ${def.key} must be a number`)
        continue
      }
      out[def.key] = num
      continue
    }
    if (def.type === 'boolean') {
      if (typeof value === 'boolean') out[def.key] = value
      else if (value === 'true') out[def.key] = true
      else if (value === 'false') out[def.key] = false
      else errors.push(`Param ${def.key} must be boolean`)
      continue
    }
    if (def.type === 'json') {
      if (typeof value === 'object' && value !== null) {
        out[def.key] = value
      } else if (typeof value === 'string') {
        try {
          out[def.key] = JSON.parse(value)
        } catch {
          errors.push(`Param ${def.key} must be valid JSON`)
        }
      } else {
        errors.push(`Param ${def.key} must be valid JSON`)
      }
      continue
    }
    out[def.key] = value
  }
  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, params: out }
}

export function normalizeScriptParams(
  scriptId: string,
  incoming: Record<string, unknown>
): { ok: true; params: Record<string, unknown> } | { ok: false; errors: string[] } {
  const def = SCRIPT_REGISTRY[scriptId]
  if (!def) return { ok: false, errors: [`Unknown script: ${scriptId}`] }
  return validateAndNormalizeParams(def.paramsSchema, incoming)
}

export const SCRIPT_REGISTRY: Record<string, ScriptDefinition> = {
  'cleanup-executions': {
    id: 'cleanup-executions',
    name: 'Cleanup Executions',
    description: 'Prunes old script execution records and logs to save database space.',
    category: 'operations',
    dangerLevel: 'warning',
    supportsDryRun: true,
    paramsSchema: [
      { key: 'days', label: 'Keep last N days', type: 'number', defaultValue: 7 },
    ],
    handler: CleanupExecutionsHandler,
  },
  'audit-security': {
    id: 'audit-security',
    name: 'Audit Security Events',
    description: 'Analyzes security logs for suspicious administrative activity.',
    category: 'security',
    dangerLevel: 'safe',
    paramsSchema: [
      { key: 'hours', label: 'Time window in hours', type: 'number', defaultValue: 24 },
    ],
    handler: AuditSecurityEventsHandler,
  },
  'audit-activity-safety': {
    id: 'audit-activity-safety',
    name: 'Audit Activity Safety (90m inactivity pause)',
    description:
      'Automatically pauses active activities that have been inactive for more than 90 minutes (uses data.lastSyncAt when set, else updatedAt).',
    category: 'security',
    dangerLevel: 'warning',
    supportsDryRun: true,
    handler: AuditActivitySafetyHandler,
  },
  'activity-background-sync': {
    id: 'activity-background-sync',
    name: 'Activity Background ESI Sync (ratting/mining/abyssal)',
    description:
      'Syncs active ratting/mining/abyssal activities from ESI while the dashboard is closed. Skips paused rows and respects min interval per activity.',
    category: 'operations',
    dangerLevel: 'warning',
    supportsDryRun: true,
    paramsSchema: [
      {
        key: 'batchSize',
        label: 'Max activities to sync per run',
        type: 'number',
        required: false,
        defaultValue: 40,
        description: 'Hard cap 200',
      },
      {
        key: 'maxCandidates',
        label: 'Max DB rows scanned per run',
        type: 'number',
        required: false,
        defaultValue: 200,
        description: 'Hard cap 500',
      },
      {
        key: 'minIntervalMs',
        label: 'Min ms since lastSyncAt before syncing again',
        type: 'number',
        required: false,
        defaultValue: 120000,
        description: 'Floor 60000',
      },
    ],
    handler: ActivityBackgroundSyncHandler,
  },
  'activity-loot-sync': {
    id: 'activity-loot-sync',
    name: 'Activity Auto Loot Sync (ratting)',
    description:
      'Syncs auto loot tracking for active ratting activities. Fetches container contents from ESI, calculates delta, and updates loot history. Runs every 15 minutes via cron.',
    category: 'operations',
    dangerLevel: 'warning',
    supportsDryRun: true,
    paramsSchema: [
      {
        key: 'batchSize',
        label: 'Max activities to sync per run',
        type: 'number',
        required: false,
        defaultValue: 40,
        description: 'Hard cap 200',
      },
      {
        key: 'maxCandidates',
        label: 'Max DB rows scanned per run',
        type: 'number',
        required: false,
        defaultValue: 200,
        description: 'Hard cap 500',
      },
      {
        key: 'minIntervalMs',
        label: 'Min ms since lastLootSyncAt before syncing again',
        type: 'number',
        required: false,
        defaultValue: 900000,
        description: 'Default 15min (900000ms)',
      },
    ],
    handler: ActivityLootSyncHandler,
  },
  'audit-subscriptions': {
    id: 'audit-subscriptions',
    name: 'Audit Subscriptions',
    description: 'Checks for expired user subscriptions and financial inconsistencies.',
    category: 'operations',
    dangerLevel: 'safe',
    handler: AuditSubscriptionsHandler,
  },
  'sync-wallet-journal': {
    id: 'sync-wallet-journal',
    name: 'Sync Corp Wallet Journal',
    description: 'Fetches corporation wallet journal from ESI and creates payments for donations. Use for manual sync or schedule via cron.',
    category: 'wallet',
    dangerLevel: 'warning',
    supportsDryRun: true,
    handler: SyncWalletJournalHandler,
  },
  'health-check': {
    id: 'health-check',
    name: 'System Health Check',
    description: 'Performs diagnostics on database connectivity and environment configuration.',
    category: 'operations',
    dangerLevel: 'safe',
    handler: SystemHealthCheckHandler,
  },
  'validate-integrity': {
    id: 'validate-integrity',
    name: 'Database Integrity Audit',
    description: 'Checks for orphaned records and subscription inconsistencies.',
    category: 'database',
    dangerLevel: 'safe',
    handler: ValidateDatabaseIntegrityHandler,
  },
  'sync-module-dogma-esi': {
    id: 'sync-module-dogma-esi',
    name: 'Sync module dogma from ESI',
    description:
      'Runs the same pipeline as GET /api/dogma?sync=true&type=modules — refreshes ModuleStats and ModuleDogmaAttribute from ESI. Optional JSON param: typeId (number) for a single module. Long-running on full sync; use dry run first.',
    category: 'fitting',
    dangerLevel: 'danger',
    executionPolicy: 'elevated',
    supportsDryRun: true,
    paramsSchema: [
      {
        key: 'typeId',
        label: 'Single module typeId (optional)',
        type: 'number',
        required: false,
        placeholder: 'e.g. 1234 — omit for full sync',
      },
    ],
    handler: SyncModuleDogmaFromEsiHandler,
  },
  'run-custom-memo-script': {
    id: 'run-custom-memo-script',
    name: 'Run Custom Memo Script',
    description:
      'Runs an ad-hoc JavaScript script pasted in the admin UI. Use for one-off production diagnostics and controlled operations.',
    category: 'custom',
    dangerLevel: 'danger',
    executionPolicy: 'elevated',
    supportsDryRun: true,
    paramsSchema: [
      {
        key: 'memoName',
        label: 'Memo name',
        type: 'string',
        required: false,
        placeholder: 'e.g. verify-fit-stats',
      },
      {
        key: 'code',
        label: 'Script code',
        type: 'textarea',
        required: true,
        placeholder:
          "addLog('info', 'hello');\nconst count = await prisma.shipStats.count();\naddLog('success', `shipStats=${count}`);",
      },
      {
        key: 'args',
        label: 'Args (JSON)',
        type: 'json',
        required: false,
        defaultValue: {},
      },
    ],
    handler: RunCustomMemoScriptHandler,
  },
  'query-ships': {
    id: 'query-ships',
    name: 'Query Ships',
    description: 'Query ships with filters (race, group, faction). Shows slots, CPU, PG, and tank.',
    category: 'database',
    dangerLevel: 'safe',
    paramsSchema: [
      { key: 'limit', label: 'Limit', type: 'number', defaultValue: 50 },
      { key: 'raceId', label: 'Race ID', type: 'number', required: false },
      { key: 'groupId', label: 'Group ID', type: 'number', required: false },
      { key: 'factionName', label: 'Faction (contains)', type: 'string', required: false },
    ],
    handler: QueryShipsHandler,
  },
  'query-characters': {
    id: 'query-characters',
    name: 'Query Characters',
    description: 'Query characters with owner info, corporation, wallet balance.',
    category: 'database',
    dangerLevel: 'safe',
    paramsSchema: [
      { key: 'limit', label: 'Limit', type: 'number', defaultValue: 50 },
      { key: 'userId', label: 'User ID', type: 'string', required: false },
    ],
    handler: QueryCharactersHandler,
  },
  'query-activities': {
    id: 'query-activities',
    name: 'Query Activities',
    description: 'Query activities by type, status, or user.',
    category: 'database',
    dangerLevel: 'safe',
    paramsSchema: [
      { key: 'limit', label: 'Limit', type: 'number', defaultValue: 50 },
      { key: 'type', label: 'Type', type: 'string', required: false },
      { key: 'status', label: 'Status', type: 'string', required: false },
    ],
    handler: QueryActivitiesHandler,
  },
  'query-modules': {
    id: 'query-modules',
    name: 'Query Modules',
    description: 'Query modules by slot type or group.',
    category: 'database',
    dangerLevel: 'safe',
    paramsSchema: [
      { key: 'limit', label: 'Limit', type: 'number', defaultValue: 50 },
      { key: 'slotType', label: 'Slot Type', type: 'string', required: false },
      { key: 'groupId', label: 'Group ID', type: 'number', required: false },
    ],
    handler: QueryModulesHandler,
  },
  'query-fits': {
    id: 'query-fits',
    name: 'Query Fits',
    description: 'Query fits by user, ship, or visibility.',
    category: 'database',
    dangerLevel: 'safe',
    paramsSchema: [
      { key: 'limit', label: 'Limit', type: 'number', defaultValue: 50 },
      { key: 'userId', label: 'User ID', type: 'string', required: false },
      { key: 'ship', label: 'Ship (contains)', type: 'string', required: false },
      { key: 'visibility', label: 'Visibility', type: 'string', required: false },
    ],
    handler: QueryFitsHandler,
  },
  'query-users': {
    id: 'query-users',
    name: 'Query Users',
    description: 'Query users with role, subscription, balance.',
    category: 'database',
    dangerLevel: 'safe',
    paramsSchema: [
      { key: 'limit', label: 'Limit', type: 'number', defaultValue: 50 },
      { key: 'role', label: 'Role', type: 'string', required: false },
      { key: 'isBlocked', label: 'Blocked', type: 'boolean', required: false },
    ],
    handler: QueryUsersHandler,
  },
  'query-payments': {
    id: 'query-payments',
    name: 'Query Payments',
    description: 'Query payments by status with summary stats.',
    category: 'database',
    dangerLevel: 'safe',
    paramsSchema: [
      { key: 'limit', label: 'Limit', type: 'number', defaultValue: 50 },
      { key: 'status', label: 'Status', type: 'string', required: false },
    ],
    handler: QueryPaymentsHandler,
  },
}