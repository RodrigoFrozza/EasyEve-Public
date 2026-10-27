'use client'

import { ArrowRight, ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { formatPiRate } from '@/lib/pi/format'
import type { PiColonyAnalysis, PiColonyRole, PiPinView } from '@/lib/pi/types'
import {
  type FlowLine,
  type PinLineNode,
  type ProductionLineStages,
  type VirtualFlowNode,
} from '@/lib/pi/chain-branches'
import { colonyRoleStageLabels } from '@/lib/pi/colony-role'
import { buildColonyGraph, buildColonyProductionStages } from '@/lib/pi/chain-graph'
import { useTranslations } from '@/i18n/hooks'
import { Button } from '@/components/ui/button'
import { PiItemIcon } from './PiItemIcon'
import { ChainGraph } from './ChainGraph'
import { ColonyRoleBadge } from './ColonyRoleBadge'

type Props = {
  colony: PiColonyAnalysis
  rateMode: 'potential' | 'current'
  /** Start collapsed — the graph is Level-3 detail. Defaults to open. */
  defaultOpen?: boolean
}

type ViewMode = 'graph' | 'list'

function formatPeerList(labels: string[]): string {
  if (labels.length === 0) return ''
  if (labels.length <= 3) return labels.join(', ')
  return `${labels.slice(0, 2).join(', ')} … ${labels[labels.length - 1]} (${labels.length})`
}

function FlowLineRow({
  line,
  direction,
  t,
}: {
  line: FlowLine
  direction: 'receive' | 'produce'
  t: (key: string) => string
}) {
  const peerText = formatPeerList(line.peerLabels)
  const fromLabel = direction === 'receive' ? t('pi.chain.from') : t('pi.chain.to')
  const showPeers = direction === 'receive' && peerText.length > 0
  const showDestPeers = direction === 'produce' && peerText.length > 0

  return (
    <li className="rounded border border-zinc-800/80 bg-zinc-900/50 px-2 py-1.5 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        {showPeers ? (
          <>
            <span className="text-zinc-500">{fromLabel}</span>
            <span className="text-zinc-400">{peerText}</span>
            <ArrowRight className="h-3 w-3 shrink-0 text-zinc-600" />
          </>
        ) : direction === 'receive' && line.sourceKind === 'import' ? (
          <>
            <span className="text-zinc-500">{t('pi.chain.imported')}</span>
            <ArrowRight className="h-3 w-3 shrink-0 text-zinc-600" />
          </>
        ) : null}
        <PiItemIcon typeId={line.typeId} name={line.name} size={20} />
        <span className="text-zinc-200">{line.name}</span>
        {line.tier != null ? (
          <span className="text-[10px] text-zinc-500">P{line.tier}</span>
        ) : null}
        <span className="tabular-nums text-cyan-300/90">
          {formatPiRate(line.unitsPerHour)}
          {t('pi.chain.perHour')}
        </span>
        {showDestPeers ? (
          <>
            <ArrowRight className="h-3 w-3 shrink-0 text-zinc-600" />
            <span className="text-zinc-400">{peerText}</span>
          </>
        ) : null}
        {line.routeQuantity != null && line.routeQuantity > 0 ? (
          <span className="text-[10px] text-zinc-600" title={t('pi.chain.routeQty')}>
            ({formatPiRate(line.routeQuantity)} {t('pi.chain.route')})
          </span>
        ) : null}
      </div>
    </li>
  )
}

function VirtualFlowCard({ node, t }: { node: VirtualFlowNode; t: (key: string) => string }) {
  const titleKey = {
    import: 'pi.chain.importNode',
    export: 'pi.chain.exportNode',
    surplus: 'pi.chain.surplusNode',
  }[node.kind]
  const sectionKey = node.kind === 'import' ? 'pi.chain.imported' : 'pi.chain.receives'

  return (
    <div className="rounded-lg border border-dashed border-zinc-700/80 bg-zinc-950/50 p-3">
      <p className="mb-2 text-xs font-semibold text-zinc-200">{t(titleKey)}</p>
      {node.flows.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-violet-300/80">{t(sectionKey)}</p>
          <ul className="space-y-1.5">
            {node.flows.map((line, idx) => (
              <FlowLineRow
                key={`${node.kind}-${line.typeId}-${idx}`}
                line={line}
                direction={node.kind === 'import' ? 'produce' : 'receive'}
                t={t}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function VirtualFlowColumn({
  title,
  nodes,
  t,
}: {
  title: string
  nodes: VirtualFlowNode[]
  t: (key: string) => string
}) {
  if (nodes.length === 0) return null

  return (
    <div className="min-w-0 flex-1">
      <div className="relative min-h-[120px] rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
        <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-violet-300">{title}</p>
        <div className="space-y-3">
          {nodes.map((node) => (
            <VirtualFlowCard key={node.kind} node={node} t={t} />
          ))}
        </div>
      </div>
    </div>
  )
}

function PinNodeCard({
  node,
  formatPinLabel,
  t,
}: {
  node: PinLineNode
  formatPinLabel: (pin: PiPinView) => string
  t: (key: string) => string
}) {
  const title = node.displayLabel ?? formatPinLabel(node.pin)

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className="text-xs font-semibold text-zinc-200">{title}</p>
        {node.groupCount != null && node.groupCount > 1 ? (
          <span className="rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-300">
            ×{node.groupCount}
          </span>
        ) : null}
        {node.pin.itemName ? (
          <span className="text-[10px] text-zinc-500">({node.pin.itemName})</span>
        ) : null}
      </div>

      {node.receives.length > 0 ? (
        <div className="mb-2 space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400/80">
            {t('pi.chain.receives')}
          </p>
          <ul className="space-y-1.5">
            {node.receives.map((line) => (
              <FlowLineRow key={`recv-${line.typeId}-${line.unitsPerHour}`} line={line} direction="receive" t={t} />
            ))}
          </ul>
        </div>
      ) : null}

      {node.produces.length > 0 ? (
        <div className="space-y-1">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/80">
            {t('pi.chain.produces')}
          </p>
          <ul className="space-y-1.5">
            {node.produces.map((line, idx) => (
              <FlowLineRow
                key={`prod-${line.typeId}-${line.unitsPerHour}-${idx}`}
                line={line}
                direction="produce"
                t={t}
              />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function StageColumn({
  title,
  nodes,
  formatPinLabel,
  t,
  emptyHint,
}: {
  title: string
  nodes: PinLineNode[]
  formatPinLabel: (pin: PiPinView) => string
  t: (key: string) => string
  emptyHint: string
}) {
  return (
    <div className="relative min-h-[120px] rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
      <p className="mb-3 text-[10px] font-bold uppercase tracking-wider text-violet-300">{title}</p>
      {nodes.length === 0 ? (
        <p className="text-xs text-zinc-600">{emptyHint}</p>
      ) : (
        <div className="space-y-3">
          {nodes.map((node) => (
            <PinNodeCard
              key={`${node.pin.pinId}-${node.groupCount ?? 1}-${node.displayLabel ?? ''}`}
              node={node}
              formatPinLabel={formatPinLabel}
              t={t}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function hasAnyNodes(stages: ProductionLineStages): boolean {
  return (
    stages.input.length > 0 ||
    stages.production.length > 0 ||
    stages.export.length > 0 ||
    stages.virtual.length > 0
  )
}

function ListView({
  stages,
  formatPinLabel,
  t,
  colonyRole,
}: {
  stages: ProductionLineStages
  formatPinLabel: (pin: PiPinView) => string
  t: (key: string) => string
  colonyRole: PiColonyRole
}) {
  const importNodes = stages.virtual.filter((node) => node.kind === 'import')
  const sinkNodes = stages.virtual.filter((node) => node.kind === 'export' || node.kind === 'surplus')
  const stageLabels = colonyRoleStageLabels(colonyRole)
  const showInputStage = stages.input.length > 0 || colonyRole !== 'factory_only'

  return (
    <div className="flex flex-col gap-3 xl:flex-row xl:items-stretch">
      {importNodes.length > 0 ? (
        <>
          <VirtualFlowColumn title={t('pi.chain.stageImport')} nodes={importNodes} t={t} />
          <ArrowRight className="mx-1 hidden h-4 w-4 shrink-0 self-center text-zinc-600 xl:block" />
        </>
      ) : null}
      {showInputStage ? (
        <>
          <div className="min-w-0 flex-1">
            <StageColumn
              title={t(stageLabels.input)}
              nodes={stages.input}
              formatPinLabel={formatPinLabel}
              t={t}
              emptyHint="—"
            />
          </div>
          <ArrowRight className="mx-1 hidden h-4 w-4 shrink-0 self-center text-zinc-600 lg:block" />
        </>
      ) : null}
      {stageLabels.showProduction ? (
        <>
          <div className="min-w-0 flex-1">
            <StageColumn
              title={t(stageLabels.production)}
              nodes={stages.production}
              formatPinLabel={formatPinLabel}
              t={t}
              emptyHint="—"
            />
          </div>
          <ArrowRight className="mx-1 hidden h-4 w-4 shrink-0 self-center text-zinc-600 lg:block" />
        </>
      ) : null}
      <div className="min-w-0 flex-1">
        <StageColumn
          title={t(stageLabels.export)}
          nodes={stages.export}
          formatPinLabel={formatPinLabel}
          t={t}
          emptyHint="—"
        />
      </div>
      {sinkNodes.length > 0 ? (
        <>
          <ArrowRight className="mx-1 hidden h-4 w-4 shrink-0 self-center text-zinc-600 xl:block" />
          <VirtualFlowColumn title={t('pi.chain.stageOutflow')} nodes={sinkNodes} t={t} />
        </>
      ) : null}
    </div>
  )
}

export function ProductionChainView({ colony, rateMode, defaultOpen = true }: Props) {
  const { t } = useTranslations()
  const [viewMode, setViewMode] = useState<ViewMode>('graph')
  const [open, setOpen] = useState(defaultOpen)

  const formatPinLabel = (pin: PiPinView) => pin.label
  // Only build the (relatively expensive) stage/graph layout when expanded.
  const resolvedStages = open ? buildColonyProductionStages(colony, rateMode, formatPinLabel) : null
  const stages = resolvedStages?.stages ?? null
  const graph = open ? buildColonyGraph(colony, rateMode) : null
  const hasRoutes = colony.routing?.routes?.length > 0

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="space-y-1">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-widest text-violet-300"
          >
            {open ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            )}
            {t('pi.chain.routes')}
          </button>
          {open && colony.colonyRole && colony.colonyRole !== 'unknown' ? (
            <ColonyRoleBadge role={colony.colonyRole} showFlow />
          ) : null}
        </div>
        {open && hasRoutes && stages && hasAnyNodes(stages) ? (
          <div className="flex gap-1 rounded-lg border border-zinc-800 p-0.5">
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'graph' ? 'secondary' : 'ghost'}
              className="h-7 text-[10px]"
              onClick={() => setViewMode('graph')}
            >
              {t('pi.chain.viewGraph')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              className="h-7 text-[10px]"
              onClick={() => setViewMode('list')}
            >
              {t('pi.chain.viewList')}
            </Button>
          </div>
        ) : null}
      </div>

      {!open ? null : !hasRoutes || !stages || !hasAnyNodes(stages) ? (
        <p className="text-xs text-zinc-500">{t('pi.chain.routesEmpty')}</p>
      ) : viewMode === 'graph' && graph ? (
        <ChainGraph graph={graph} />
      ) : (
        <ListView
          stages={stages}
          formatPinLabel={formatPinLabel}
          t={t}
          colonyRole={colony.colonyRole ?? 'unknown'}
        />
      )}
    </section>
  )
}
