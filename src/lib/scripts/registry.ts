import { SyncWalletJournalHandler } from '../../../scripts/admin/handlers/syncWalletJournal'
import { SystemHealthCheckHandler } from '../../../scripts/admin/handlers/systemHealthCheck'
import { SyncModuleDogmaFromEsiHandler } from '../../../scripts/admin/handlers/syncModuleDogmaFromEsi'
import { RunCustomMemoScriptHandler } from '../../../scripts/admin/handlers/runCustomMemoScript'
import { QueryShipsHandler } from '../../../scripts/admin/handlers/queryShips'
import { QueryCharactersHandler } from '../../../scripts/admin/handlers/queryCharacters'
import { QueryActivitiesHandler } from '../../../scripts/admin/handlers/queryActivities'
import { QueryModulesHandler } from '../../../scripts/admin/handlers/queryModules'
import { QueryFitsHandler } from '../../../scripts/admin/handlers/queryFits'
import { QueryUsersHandler } from '../../../scripts/admin/handlers/queryUsers'
import { QueryPaymentsHandler } from '../../../scripts/admin/handlers/queryPayments'
import { ValidateMiningTypesHandler } from '../../../scripts/admin/handlers/validateMiningTypes'
import { AutoActivityDetectionHandler } from '../../../scripts/admin/handlers/autoActivityDetection'
import { SyncMiningSdeHandler } from '../../../scripts/admin/handlers/syncMiningSde'
import { SyncBlueprintsHandler } from '../../../scripts/admin/handlers/syncBlueprints'
import { TagCharactersHandler } from '../../../scripts/admin/handlers/tagCharacters'
import { AuditActivitySafetyHandler } from '../../../scripts/admin/handlers/auditActivitySafety'
import { SnapshotMonitoredMarketsHandler } from '../../../scripts/admin/handlers/snapshotMonitoredMarkets'
import { PiPlanetAlertsHandler } from '../../../scripts/admin/handlers/piPlanetAlerts'
import { PiV2PlanetAlertsHandler } from '../../../scripts/admin/handlers/piV2PlanetAlerts'
import { DiagnoseMiningActivityHandler } from '../../../scripts/admin/handlers/diagnoseMiningActivity'

import { SystemMaintenanceHandler } from '../../../scripts/admin/handlers/systemMaintenance'
import { UnifiedActivitySyncHandler } from '../../../scripts/admin/handlers/unifiedActivitySync'
import { AdminOverviewAuditHandler } from '../../../scripts/admin/handlers/auditAdminOverview'

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
  'system-maintenance': {
    id: 'system-maintenance',
    name: 'System Maintenance (Unified)',
    description: 'Unified task for cleanup, cache clearing, and database integrity audits.',
    category: 'operations',
    dangerLevel: 'warning',
    supportsDryRun: true,
    paramsSchema: [
      { key: 'days', label: 'Keep executions for N days', type: 'number', defaultValue: 7 },
    ],
    handler: SystemMaintenanceHandler,
  },
  'unified-activity-sync': {
    id: 'unified-activity-sync',
    name: 'Unified Activity Sync (Background + Loot)',
    description:
      'Syncs active ratting/mining/abyssal/exploration progress, recently completed mining (post-finish ledger window), and ratting loot in one pass.',
    category: 'operations',
    dangerLevel: 'warning',
    supportsDryRun: true,
    handler: UnifiedActivitySyncHandler,
  },
  'audit-admin-overview': {
    id: 'audit-admin-overview',
    name: 'Admin Overview Audit (Security + Subscriptions)',
    description: 'Analyzes security logs and checks user subscriptions/balances.',
    category: 'security',
    dangerLevel: 'safe',
    handler: AdminOverviewAuditHandler,
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
  'diagnose-mining-activity': {
    id: 'diagnose-mining-activity',
    name: 'Diagnose Mining Activity',
    description:
      'Compares session oreBreakdown vs ESI ledger and baselines for a single mining activity (support/debug).',
    category: 'database',
    dangerLevel: 'safe',
    paramsSchema: [
      {
        key: 'activityId',
        label: 'Activity ID',
        type: 'string',
        required: true,
        placeholder: 'cuid of mining activity',
      },
    ],
    handler: DiagnoseMiningActivityHandler,
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
  'validate-mining-types': {
    id: 'validate-mining-types',
    name: 'Validate Mining Types',
    description: 'Checks if Ore, Ice, Gas, and Moon type IDs exist in production DB (all variants).',
    category: 'database',
    dangerLevel: 'safe',
    handler: ValidateMiningTypesHandler,
  },
  'auto-activity-detection': {
    id: 'auto-activity-detection',
    name: 'Auto-Activity Detection (ratting/mining)',
    description: 'Detects new mining/ratting activities, pauses stale sessions (60m), and finalizes sessions paused > 6h.',
    category: 'operations',
    dangerLevel: 'warning',
    supportsDryRun: true,
    handler: AutoActivityDetectionHandler,
  },
  'sync-mining-sde': {
    id: 'sync-mining-sde',
    name: 'Sync/Refresh Mining SDE',
    description: 'Clears and repopulates EVE SDE data (Categories, Groups, Types) from official CCP JSONL zip. Use when market lists are empty or missing variants.',
    category: 'database',
    dangerLevel: 'danger',
    supportsDryRun: true,
    paramsSchema: [
      { key: 'forceDownload', label: 'Force Redownload SDE Zip', type: 'boolean', defaultValue: false },
    ],
    handler: SyncMiningSdeHandler,
  },
  'sync-blueprints': {
    id: 'sync-blueprints',
    name: 'Import Blueprint Catalogue',
    description: 'Imports the industry blueprint recipes (manufacturing / reaction / invention materials, products, times) from the official CCP SDE zip into Blueprint / BlueprintMaterial / BlueprintProduct. Idempotent. Run sync-mining-sde first so referenced EveType rows exist.',
    category: 'database',
    dangerLevel: 'warning',
    supportsDryRun: true,
    paramsSchema: [
      { key: 'forceDownload', label: 'Force Redownload SDE Zip', type: 'boolean', defaultValue: false },
    ],
    handler: SyncBlueprintsHandler,
  },
  'tag-characters': {
    id: 'tag-characters',
    name: 'Tag All Characters',
    description: 'Adds "Ratter" and "Miner" tags to all authenticated characters.',
    category: 'database',
    dangerLevel: 'warning',
    supportsDryRun: true,
    handler: TagCharactersHandler,
  },
  'audit-activity-safety': {
    id: 'audit-activity-safety',
    name: 'Audit Activity Safety',
    description: 'Standalone safety audit: Pauses activities inactive for >60 minutes and terminates (completes) activities paused/stale for >6 hours.',
    category: 'security',
    dangerLevel: 'warning',
    supportsDryRun: true,
    handler: AuditActivitySafetyHandler,
  },
  'snapshot-monitored-markets': {
    id: 'snapshot-monitored-markets',
    name: 'Snapshot Monitored Structure Markets',
    description:
      'Captures a daily per-type order-book snapshot (sell/buy volume, best sell/buy) for every private structure monitored by any user\'s Industry deficit scanner. ESI has no public history endpoint for structure markets, so this is our only source of price/volume history for them. Run daily via schedule.',
    category: 'database',
    dangerLevel: 'safe',
    supportsDryRun: true,
    handler: SnapshotMonitoredMarketsHandler,
  },
  'pi-planet-alerts': {
    id: 'pi-planet-alerts',
    name: 'PI Planet Buffer & Extractor Alerts (v1 — em aposentadoria)',
    description:
      'EM APOSENTADORIA — substituído por "pi-v2-planet-alerts". Carrega um bug conhecido e não corrigido: em cadeia integrada, a entrada de um intermediário local é creditada pela metade, e um buffer balanceado aparece drenando (alerta de esvaziamento que não existe). Ao agendar o handler v2, REMOVA/PAUSE o schedule deste no mesmo movimento — rodar os dois em paralelo entrega o alerta certo e o errado para a mesma colônia. Sweeps every user\'s PI colonies for a buffer about to starve/overflow, a stalled factory, or an expired extractor, and creates an in-app notification (existing bell UI) when found and not already open within the cooldown window. Does not touch pricing — reuses the same cached layout/planet ESI calls the dashboard already makes.',
    category: 'operations',
    dangerLevel: 'safe',
    supportsDryRun: true,
    handler: PiPlanetAlertsHandler,
  },
  'pi-v2-planet-alerts': {
    id: 'pi-v2-planet-alerts',
    name: 'PI v2 — Alertas de Colônia',
    description:
      'Versão v2 da varredura de alertas de PI, atrás da flag PI_V2 (só varre usuários com ela ligada; com a flag desligada para todos, não faz nada). ⚠️ Ao criar o schedule DESTE handler, remova/pause o do "pi-planet-alerts" (v1) no mesmo movimento — os dois em paralelo entregam o alerta certo e o errado para a mesma colônia. Roda o mesmo motor de projeção da tela, então o alerta e o número exibido nunca divergem. Cobre as três camadas — insumo acabando, espaço acabando e extrator expirando — mais o dado velho demais para projetar, e NÃO alerta o ciclo normal de reabastecimento. Anti-spam em duas camadas: cooldown por problema (amarrado à cadência de visita) e um digest por varredura em vez de um ping por problema. Não chama preço nem gera chamada extra à ESI (usa o mesmo cache do dashboard). Rodar a cada 15 minutos via schedule.',
    category: 'operations',
    dangerLevel: 'safe',
    supportsDryRun: true,
    handler: PiV2PlanetAlertsHandler,
  },
}