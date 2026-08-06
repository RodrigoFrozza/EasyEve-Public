/** One priced line of an appraisal. Prices are a snapshot frozen at creation. */
export interface AppraisalLineItem {
  typeId: number
  name: string
  quantity: number

  /** m³ per unit (SDE `EveType.volume`). Null when the SDE has no volume for this type. */
  volume: number | null
  /** SDE group name (e.g. "Ice Product", "Salvaged Materials") for a quick visual cue. */
  groupName: string | null

  /**
   * Reference unit prices — the ecosystem convention (Janice / Evepraisal): a
   * robust top-of-market price (5% volume percentile, outlier-filtered), NOT a
   * single top order and NOT an order-book walk. This is what a contract is
   * priced at, so cross-checks against Janice line up.
   */
  buyUnit: number
  sellUnit: number
  /** (buyUnit + sellUnit) / 2 — the Janice "split" reference. */
  splitUnit: number

  /**
   * Reference totals = unit × quantity. Deliberately NOT an order-book walk:
   * a contract is priced at a reference, not by depleting the live book.
   */
  buyTotal: number
  sellTotal: number
  /** (buyTotal + sellTotal) / 2. */
  splitTotal: number

  /**
   * Execution reality from walking the real book for `quantity` — powers the
   * thin-book warning (regra de ouro #5: números otimistas exigem sinalização).
   * NEVER drives the headline total.
   */
  buyFilledQty: number
  sellFilledQty: number
  /** False when the book (hub-filtered, top levels) can't absorb the full quantity. */
  buySufficient: boolean
  sellSufficient: boolean

  /** Snapshot older than one refresh cycle (live fetch is failing) — UI must warn. */
  stale: boolean
  /** No sell AND no buy orders at all for this item at the chosen market. */
  noOrders: boolean
}

export interface AppraisalResult {
  items: AppraisalLineItem[]
  /** Pasted names that resolved to no published SDE type — surfaced, never silently dropped. */
  unresolvedNames: string[]
  totalBuy: number
  totalSell: number
  totalSplit: number
}

/** One pasted line, pre-merge. Powers the share page's "stack" (separate lines) toggle. */
export interface AppraisalRawEntry {
  typeId: number
  name: string
  quantity: number
}

export type AppraisalMarketKind = 'jita' | 'structure'
