'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Maximize2, RotateCcw, X, ZoomIn, ZoomOut } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { formatPiRate } from '@/lib/pi/format'
import type { FlowLine } from '@/lib/pi/chain-branches'
import {
  CHAIN_NODE_MIN_HEIGHT,
  CHAIN_NODE_WIDTH,
  COLONY_EXPORT_NODE_ID,
  COLONY_IMPORT_NODE_ID,
  COLONY_SURPLUS_NODE_ID,
  EXTERNAL_IN_NODE_ID,
  EXTERNAL_OUT_NODE_ID,
  edgeStrokeWidth,
  getHighlightedGraphIds,
  layoutChainGraph,
  tierEdgeColor,
  type ChainEdge,
  type ChainGraph,
  type ChainNode,
  type LayoutBounds,
} from '@/lib/pi/chain-graph'
import { useTranslations } from '@/i18n/hooks'
import { Button } from '@/components/ui/button'
import { PiItemIcon } from './PiItemIcon'

type Props = {
  graph: ChainGraph
  className?: string
}

type Point = { x: number; y: number }

type EdgeLayoutMeta = {
  edge: ChainEdge
  sourceIndex: number
  sourceCount: number
  targetIndex: number
  targetCount: number
}

type EdgeGeometry = {
  path: string
  arrow: string
  label: Point
}

const PORT_SPREAD = 20
const ARROW_HEAD_LENGTH = 8
// Floor the fit-to-view scale so a dense colony becomes pannable instead of
// shrinking the 9–11px card text into illegibility.
const MIN_SCALE = 0.4
const MAX_SCALE = 2
const VIEWPORT_HEIGHT = 480

type ViewTransform = { scale: number; tx: number; ty: number }

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

function fitViewTransform(
  viewportWidth: number,
  viewportHeight: number,
  worldWidth: number,
  worldHeight: number,
  padding = 32
): ViewTransform {
  if (viewportWidth <= 0 || viewportHeight <= 0 || worldWidth <= 0 || worldHeight <= 0) {
    return { scale: 1, tx: 0, ty: 0 }
  }
  const scaleX = (viewportWidth - padding) / worldWidth
  const scaleY = (viewportHeight - padding) / worldHeight
  const scale = clampScale(Math.min(scaleX, scaleY, 1))
  return {
    scale,
    tx: Math.max(padding / 2, (viewportWidth - worldWidth * scale) / 2),
    ty: Math.max(padding / 2, (viewportHeight - worldHeight * scale) / 2),
  }
}

function zoomAtPoint(view: ViewTransform, mx: number, my: number, factor: number): ViewTransform {
  const newScale = clampScale(view.scale * factor)
  const worldX = (mx - view.tx) / view.scale
  const worldY = (my - view.ty) / view.scale
  return {
    scale: newScale,
    tx: mx - worldX * newScale,
    ty: my - worldY * newScale,
  }
}

function isInteractiveGraphTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return Boolean(target.closest('[data-graph-node], [data-graph-edge], button'))
}

type FlowNodeLabels = {
  importNode: string
  exportNode: string
  surplusNode: string
}

function resolveNodeLabel(
  node: ChainNode,
  externalInLabel: string,
  externalOutLabel: string,
  flowLabels: FlowNodeLabels
): string {
  if (node.id === EXTERNAL_IN_NODE_ID) return externalInLabel
  if (node.id === EXTERNAL_OUT_NODE_ID) return externalOutLabel
  if (node.id === COLONY_IMPORT_NODE_ID) return flowLabels.importNode
  if (node.id === COLONY_EXPORT_NODE_ID) return flowLabels.exportNode
  if (node.id === COLONY_SURPLUS_NODE_ID) return flowLabels.surplusNode
  return node.label
}

function isVirtualImportNode(node: ChainNode): boolean {
  return node.role === 'import'
}

function isVirtualSinkNode(node: ChainNode): boolean {
  return node.role === 'export' || node.role === 'surplus'
}

/** Left-border accent so a node's role reads at a glance without parsing the title. */
function roleAccentColor(role: ChainNode['role']): string {
  switch (role) {
    case 'extractor':
      return '#f59e0b' // amber
    case 'basic_processor':
    case 'advanced_processor':
    case 'high_tech_processor':
      return '#60a5fa' // blue — factories
    case 'storage':
      return '#94a3b8' // slate
    case 'launchpad':
      return '#34d399' // emerald
    case 'command_center':
      return '#a78bfa' // violet
    case 'import':
      return '#22d3ee' // cyan
    case 'export':
      return '#fbbf24' // amber-yellow
    case 'surplus':
      return '#71717a' // zinc
    default:
      return '#3f3f46' // planet / external / link / unknown
  }
}

function edgeGeometry(
  source: LayoutBounds,
  target: LayoutBounds,
  sourceIndex: number,
  targetIndex: number,
  sourceCount: number,
  targetCount: number
): EdgeGeometry {
  const sOff = sourceCount > 1 ? (sourceIndex - (sourceCount - 1) / 2) * PORT_SPREAD : 0
  const tOff = targetCount > 1 ? (targetIndex - (targetCount - 1) / 2) * PORT_SPREAD : 0

  const x1 = source.x + source.width
  const y1 = source.y + source.height / 2 + sOff
  const x2 = target.x - ARROW_HEAD_LENGTH
  const y2 = target.y + target.height / 2 + tOff

  // Smooth cubic bezier with horizontal handles: fan-outs/fan-ins separate
  // naturally by their endpoints instead of piling into a wall of shared
  // orthogonal corridors, which is what made dense colonies unreadable.
  const dx = Math.max(40, (x2 - x1) * 0.5)
  const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`
  const arrow = `M ${x2} ${y2 - 5} L ${target.x} ${y2} L ${x2} ${y2 + 5}`

  return { path, arrow, label: { x: (x1 + x2) / 2, y: (y1 + y2) / 2 } }
}

function groupEdgesBy(
  edges: ChainEdge[],
  key: (e: ChainEdge) => string
): Map<string, ChainEdge[]> {
  const map = new Map<string, ChainEdge[]>()
  for (const edge of edges) {
    const k = key(edge)
    const list = map.get(k)
    if (list) list.push(edge)
    else map.set(k, [edge])
  }
  return map
}

function medianOf(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.floor(sorted.length / 2)]
}

// Give each edge a source/target PORT keyed by commodity type, and order the
// ports by the vertical position of the opposite endpoint. Two effects:
//  (2) same-commodity edges leaving a node share one port — they read as a
//      single bundle fanning out instead of N separate parallel lines.
//  (3) ordering ports by the other end's y untwists fan-outs/ins so the curves
//      cross far less.
function buildEdgeLayoutMeta(
  edges: ChainEdge[],
  boundsById: Map<string, LayoutBounds>
): EdgeLayoutMeta[] {
  const midY = (nodeId: string): number => {
    const b = boundsById.get(nodeId)
    return b ? b.y + b.height / 2 : 0
  }

  const portInfo = (
    grouped: Map<string, ChainEdge[]>,
    oppositeId: (e: ChainEdge) => string
  ): Map<string, { index: Map<number, number>; count: number }> => {
    const result = new Map<string, { index: Map<number, number>; count: number }>()
    for (const [nodeId, list] of grouped) {
      const byType = groupEdgesBy(list, (e) => String(e.typeId))
      const ordered = [...byType.entries()].sort(
        (a, b) =>
          medianOf(a[1].map((e) => midY(oppositeId(e)))) -
          medianOf(b[1].map((e) => midY(oppositeId(e))))
      )
      const index = new Map<number, number>()
      ordered.forEach(([typeId], i) => index.set(Number(typeId), i))
      result.set(nodeId, { index, count: ordered.length })
    }
    return result
  }

  const sourcePorts = portInfo(
    groupEdgesBy(edges, (e) => e.sourceNodeId),
    (e) => e.targetNodeId
  )
  const targetPorts = portInfo(
    groupEdgesBy(edges, (e) => e.targetNodeId),
    (e) => e.sourceNodeId
  )

  return edges.map((edge) => {
    const s = sourcePorts.get(edge.sourceNodeId)
    const t = targetPorts.get(edge.targetNodeId)
    return {
      edge,
      sourceIndex: s?.index.get(edge.typeId) ?? 0,
      sourceCount: s?.count ?? 1,
      targetIndex: t?.index.get(edge.typeId) ?? 0,
      targetCount: t?.count ?? 1,
    }
  })
}

function FlowChip({ line, t }: { line: FlowLine; t: (key: string) => string }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded border border-zinc-800 bg-zinc-900/80 px-1 py-0.5 text-[10px] text-zinc-300">
      <PiItemIcon typeId={line.typeId} name={line.name} size={14} />
      <span className="truncate">{line.name}</span>
      <span className="tabular-nums text-cyan-300/90">
        {formatPiRate(line.unitsPerHour)}
        {t('pi.chain.perHour')}
      </span>
    </span>
  )
}

function GraphNodeCard({
  node,
  bounds,
  label,
  isHighlighted,
  isDimmed,
  isSelected,
  onSelect,
  onKeyDown,
  t,
}: {
  node: ChainNode
  bounds: LayoutBounds
  label: string
  isHighlighted: boolean
  isDimmed: boolean
  isSelected: boolean
  onSelect: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  t: (key: string) => string
}) {
  const receives = node.receives.slice(0, 2)
  const produces = node.produces.slice(0, 2)
  const extraReceives = node.receives.length - receives.length
  const extraProduces = node.produces.length - produces.length
  const accent = roleAccentColor(node.role)

  return (
    <motion.button
      type="button"
      aria-label={label}
      aria-pressed={isSelected}
      onClick={onSelect}
      onKeyDown={onKeyDown}
      className={cn(
        'absolute left-0 top-0 z-20 overflow-hidden rounded-lg border bg-zinc-950/95 p-2.5 text-left shadow-lg',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60',
        isSelected
          ? 'border-violet-400/60 ring-1 ring-violet-400/30'
          : isHighlighted
            ? 'border-zinc-700'
            : 'border-zinc-800'
      )}
      data-graph-node
      style={{
        width: bounds.width,
        height: bounds.height,
        boxSizing: 'border-box',
        borderLeft: `3px solid ${accent}`,
        transform: `translate(${bounds.x}px, ${bounds.y}px)`,
        opacity: isDimmed ? 0.28 : 1,
      }}
      animate={{ opacity: isDimmed ? 0.28 : 1 }}
      transition={{ duration: 0.2 }}
    >
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-zinc-100">{label}</p>
        {node.groupCount != null && node.groupCount > 1 ? (
          <span className="rounded bg-violet-500/15 px-1 py-0.5 text-[9px] font-bold text-violet-300">
            ×{node.groupCount}
          </span>
        ) : null}
      </div>
      {node.itemName ? (
        <p className="mb-1 truncate text-[10px] text-zinc-500">({node.itemName})</p>
      ) : null}
      {receives.length > 0 && !isVirtualImportNode(node) ? (
        <div className="mb-1 space-y-0.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-blue-400/70">
            {t('pi.chain.receives')}
            {extraReceives > 0 ? <span className="text-zinc-500"> +{extraReceives}</span> : null}
          </p>
          <div className="flex flex-wrap gap-1">
            {receives.map((line) => (
              <FlowChip key={`r-${line.typeId}`} line={line} t={t} />
            ))}
          </div>
        </div>
      ) : null}
      {produces.length > 0 && !isVirtualSinkNode(node) ? (
        <div className="space-y-0.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-400/70">
            {t(isVirtualImportNode(node) ? 'pi.chain.imported' : 'pi.chain.produces')}
            {extraProduces > 0 ? <span className="text-zinc-500"> +{extraProduces}</span> : null}
          </p>
          <div className="flex flex-wrap gap-1">
            {produces.map((line) => (
              <FlowChip key={`p-${line.typeId}`} line={line} t={t} />
            ))}
          </div>
        </div>
      ) : null}
    </motion.button>
  )
}

function EdgeLabel({
  edge,
  x,
  y,
  isHighlighted,
  isDimmed,
  isSelected,
  onSelect,
}: {
  edge: ChainEdge
  x: number
  y: number
  isHighlighted: boolean
  isDimmed: boolean
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      aria-label={`${edge.name} ${formatPiRate(edge.unitsPerHour)}`}
      onClick={onSelect}
      className={cn(
        'absolute z-[15] flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[9px] shadow-md',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/60',
        isSelected
          ? 'border-violet-400/50 bg-violet-950/90 text-violet-100'
          : 'border-zinc-700/80 bg-zinc-900/95 text-zinc-300'
      )}
      data-graph-edge
      style={{
        left: x,
        top: y,
        transform: 'translate(-50%, -50%)',
        opacity: isDimmed ? 0.15 : isHighlighted ? 1 : 0.75,
        pointerEvents: isDimmed ? 'none' : 'auto',
      }}
    >
      <PiItemIcon typeId={edge.typeId} name={edge.name} size={12} />
      <span className="tabular-nums">{formatPiRate(edge.unitsPerHour)}</span>
    </button>
  )
}

export function ChainGraph({
  graph,
  className,
}: Props) {
  const { t } = useTranslations()
  const externalInLabel = t('pi.chain.externalIn')
  const externalOutLabel = t('pi.chain.externalOut')
  const prefersReducedMotion = useReducedMotion()
  const viewportRef = useRef<HTMLDivElement>(null)
  const panRef = useRef({
    active: false,
    pointerId: -1,
    startX: 0,
    startY: 0,
    startTx: 0,
    startTy: 0,
    moved: false,
  })
  const [view, setView] = useState<ViewTransform>({ scale: 1, tx: 0, ty: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null)

  const layout = useMemo(() => layoutChainGraph(graph), [graph])
  const worldWidth = layout.width
  const worldHeight = layout.height
  const boundsById = useMemo(
    () => new Map(layout.nodes.map((b) => [b.nodeId, b])),
    [layout.nodes]
  )
  const edgeLayoutMeta = useMemo(
    () => buildEdgeLayoutMeta(graph.edges, boundsById),
    [graph.edges, boundsById]
  )

  const highlight = useMemo(
    () => getHighlightedGraphIds(graph, selectedNodeId, selectedTypeId),
    [graph, selectedNodeId, selectedTypeId]
  )

  const hasSelection = selectedNodeId != null || selectedTypeId != null
  const transition = prefersReducedMotion ? { duration: 0 } : { duration: 0.2 }

  const clearSelection = useCallback(() => {
    setSelectedNodeId(null)
    setSelectedTypeId(null)
  }, [])

  const fitView = useCallback(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    setView(fitViewTransform(viewport.clientWidth, viewport.clientHeight, worldWidth, worldHeight))
  }, [worldWidth, worldHeight])

  const resetView = useCallback(() => {
    setView({ scale: 1, tx: 0, ty: 0 })
  }, [])

  const zoomBy = useCallback((factor: number) => {
    const viewport = viewportRef.current
    if (!viewport) return
    const cx = viewport.clientWidth / 2
    const cy = viewport.clientHeight / 2
    setView((current) => zoomAtPoint(current, cx, cy, factor))
  }, [])

  useEffect(() => {
    fitView()
  }, [graph, fitView])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const rect = viewport.getBoundingClientRect()
      const mx = event.clientX - rect.left
      const my = event.clientY - rect.top
      const factor = event.deltaY < 0 ? 1.12 : 0.88
      setView((current) => zoomAtPoint(current, mx, my, factor))
    }

    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [])

  const onPanPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isInteractiveGraphTarget(event.target)) return
    panRef.current = {
      active: true,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startTx: view.tx,
      startTy: view.ty,
      moved: false,
    }
    setIsPanning(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPanPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current
    if (!pan.active || event.pointerId !== pan.pointerId) return
    const dx = event.clientX - pan.startX
    const dy = event.clientY - pan.startY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) pan.moved = true
    setView((current) => ({
      ...current,
      tx: pan.startTx + dx,
      ty: pan.startTy + dy,
    }))
  }

  const onPanPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current
    if (!pan.active || event.pointerId !== pan.pointerId) return
    if (!pan.moved && !isInteractiveGraphTarget(event.target)) {
      clearSelection()
    }
    panRef.current.active = false
    panRef.current.pointerId = -1
    setIsPanning(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') clearSelection()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [clearSelection])

  const selectNode = (nodeId: string) => {
    setSelectedTypeId(null)
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId))
  }

  const selectEdge = (edge: ChainEdge) => {
    setSelectedNodeId(null)
    setSelectedTypeId((prev) => (prev === edge.typeId ? null : edge.typeId))
  }

  const selectedProductName =
    selectedTypeId != null
      ? graph.edges.find((e) => e.typeId === selectedTypeId)?.name ?? `Type ${selectedTypeId}`
      : null

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-zinc-500">{t('pi.chain.dragHint')}</p>
        <div className="flex flex-wrap items-center gap-2">
          {hasSelection ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 text-[10px] text-zinc-400"
              onClick={clearSelection}
            >
              <X className="mr-1 h-3 w-3" />
              {t('pi.chain.clearSelection')}
            </Button>
          ) : null}
        </div>
      </div>

      {selectedProductName ? (
        <p className="text-xs text-violet-300">
          {t('pi.chain.pathFor')} <span className="font-semibold">{selectedProductName}</span>
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3 text-[10px] text-zinc-500">
        <span className="font-bold uppercase tracking-wider text-zinc-400">{t('pi.chain.legend')}</span>
        {[0, 1, 2, 3, 4].map((tier) => (
          <span key={tier} className="inline-flex items-center gap-1">
            <span
              className="h-2 w-6 rounded-sm"
              style={{ backgroundColor: tierEdgeColor(tier as 0 | 1 | 2 | 3 | 4) }}
            />
            P{tier}
          </span>
        ))}
      </div>

      <div
        ref={viewportRef}
        className={cn(
          'relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/40',
          isPanning ? 'cursor-grabbing' : 'cursor-grab'
        )}
        style={{ height: VIEWPORT_HEIGHT }}
      >
        <div className="absolute right-2 top-2 z-30 flex gap-1">
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-7 w-7"
            title={t('pi.chain.zoomIn')}
            aria-label={t('pi.chain.zoomIn')}
            onClick={() => zoomBy(1.15)}
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-7 w-7"
            title={t('pi.chain.zoomOut')}
            aria-label={t('pi.chain.zoomOut')}
            onClick={() => zoomBy(0.87)}
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-7 w-7"
            title={t('pi.chain.resetView')}
            aria-label={t('pi.chain.resetView')}
            onClick={resetView}
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="h-7 w-7"
            title={t('pi.chain.fitView')}
            aria-label={t('pi.chain.fitView')}
            onClick={fitView}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div
          className="absolute left-0 top-0 touch-none"
          style={{
            width: worldWidth,
            height: worldHeight,
            transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
            transformOrigin: '0 0',
          }}
          onPointerDown={onPanPointerDown}
          onPointerMove={onPanPointerMove}
          onPointerUp={onPanPointerUp}
          onPointerCancel={onPanPointerUp}
        >
          <div className="relative" style={{ width: worldWidth, height: worldHeight }}>
          <svg
            className="pointer-events-none absolute inset-0 z-0"
            width={worldWidth}
            height={worldHeight}
            aria-hidden
          >
            {edgeLayoutMeta.map(({ edge, sourceIndex, sourceCount, targetIndex, targetCount }) => {
              const source = boundsById.get(edge.sourceNodeId)
              const target = boundsById.get(edge.targetNodeId)
              if (!source || !target) return null

              const isEdgeHighlighted = highlight.edgeIds.has(edge.id)
              const isDimmed = hasSelection && !isEdgeHighlighted
              const color = tierEdgeColor(edge.tier)
              const strokeW = edgeStrokeWidth(edge.unitsPerHour)
              const geom = edgeGeometry(
                source,
                target,
                sourceIndex,
                targetIndex,
                sourceCount,
                targetCount
              )
              const opacity = hasSelection
                ? isDimmed
                  ? 0.12
                  : isEdgeHighlighted
                    ? 0.95
                    : 0.3
                : 0.65

              return (
                <g key={edge.id}>
                  <motion.path
                    d={geom.path}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeW}
                    strokeLinecap="round"
                    animate={{ opacity }}
                    transition={transition}
                  />
                  <motion.path
                    d={geom.arrow}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeW}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    animate={{ opacity }}
                    transition={transition}
                  />
                </g>
              )
            })}
          </svg>

          {edgeLayoutMeta.map(({ edge, sourceIndex, sourceCount, targetIndex, targetCount }) => {
            const source = boundsById.get(edge.sourceNodeId)
            const target = boundsById.get(edge.targetNodeId)
            if (!source || !target) return null

            const geom = edgeGeometry(
              source,
              target,
              sourceIndex,
              targetIndex,
              sourceCount,
              targetCount
            )
            const isEdgeHighlighted = highlight.edgeIds.has(edge.id)
            const isDimmed = hasSelection && !isEdgeHighlighted

            // Rate labels only for the highlighted path (on selection). Showing
            // every label at once is what turned dense colonies into a cloud of
            // scattered numbers — default view stays clean, click to read rates.
            if (!hasSelection || !isEdgeHighlighted) return null

            return (
              <EdgeLabel
                key={`label-${edge.id}`}
                edge={edge}
                x={geom.label.x}
                y={geom.label.y}
                isHighlighted={isEdgeHighlighted}
                isDimmed={isDimmed}
                isSelected={selectedTypeId === edge.typeId}
                onSelect={() => selectEdge(edge)}
              />
            )
          })}

          {graph.nodes.map((node) => {
            const bounds = boundsById.get(node.id)
            if (!bounds) return null

            const label = resolveNodeLabel(node, externalInLabel, externalOutLabel, {
              importNode: t('pi.chain.importNode'),
              exportNode: t('pi.chain.exportNode'),
              surplusNode: t('pi.chain.surplusNode'),
            })
            const isNodeHighlighted = highlight.nodeIds.has(node.id)
            const isDimmed = hasSelection && !isNodeHighlighted

            return (
              <GraphNodeCard
                key={node.id}
                node={node}
                bounds={bounds}
                label={label}
                isHighlighted={isNodeHighlighted}
                isDimmed={isDimmed}
                isSelected={selectedNodeId === node.id}
                onSelect={() => selectNode(node.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    selectNode(node.id)
                  }
                }}
                t={t}
              />
            )
          })}
          </div>
        </div>
      </div>
    </div>
  )
}

export { CHAIN_NODE_WIDTH, CHAIN_NODE_MIN_HEIGHT }
