'use client'

import React from 'react'
import { cn, formatISK } from '@/lib/utils'
import { MarketOrder } from '@/lib/constants/market'

interface OrderTableProps {
  orders: MarketOrder[]
  type: 'sell' | 'buy'
  loading?: boolean
}

export function OrderTable({ orders, type, loading }: OrderTableProps) {
  const isSell = type === 'sell'
  const headerText = isSell ? 'text-emerald-400' : 'text-cyan-400'
  const rowHover = isSell ? 'hover:bg-emerald-500/5' : 'hover:bg-cyan-500/5'
  const priceColor = isSell ? 'text-emerald-400' : 'text-cyan-400'
  const dot = isSell ? 'bg-emerald-500' : 'bg-cyan-500'

  if (loading) {
    return (
      <div className="flex flex-col bg-zinc-950/20 rounded-lg border border-white/5">
        <div className="px-4 py-2.5 flex items-center gap-2 border-b border-white/5">
          <div className={cn('w-1.5 h-1.5 rounded-full animate-pulse', dot)} />
          <span className={cn('text-xs font-semibold', headerText)}>{isSell ? 'Sell orders' : 'Buy orders'}</span>
        </div>
        <div className="p-3 space-y-2.5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex gap-4 items-center">
              <div className="w-20 h-3 bg-white/5 rounded animate-pulse" />
              <div className="w-14 h-3 bg-white/5 rounded animate-pulse" />
              <div className="flex-1 h-3 bg-white/5 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-zinc-950/20 rounded-lg border border-white/5">
      <div className="px-4 py-2.5 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className={cn('w-1.5 h-1.5 rounded-full', dot)} />
          <span className={cn('text-xs font-semibold', headerText)}>{isSell ? 'Sell orders' : 'Buy orders'}</span>
        </div>
        <span className="text-[11px] text-zinc-500">{orders.length}</span>
      </div>

      <div className="px-3 pt-2">
        <div className="flex gap-4 px-2 py-1 text-[10px] font-semibold text-zinc-600 uppercase tracking-wide border-b border-white/5 mb-1">
          <span className="w-28">Price</span>
          <span className="w-16">Qty</span>
          <span className="flex-1">Location</span>
        </div>

        <div className="space-y-px max-h-[420px] overflow-y-auto custom-scrollbar pb-2">
          {orders.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-600">No active orders</div>
          ) : (
            orders.map((order) => (
              <div
                key={order.order_id}
                className={cn('flex gap-4 px-2 py-1.5 text-xs rounded-md transition-colors', rowHover)}
              >
                <span className={cn('w-28 font-mono font-semibold', priceColor)}>
                  {formatISK(order.price)}
                </span>
                <span className="w-16 text-zinc-400">
                  {order.volume_remain.toLocaleString()}
                </span>
                <span className="flex-1 text-zinc-500 truncate" title={order.location_name}>
                  {order.location_name || `Station ${order.location_id}`}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

interface OrderPanelsProps {
  sellOrders: MarketOrder[]
  buyOrders: MarketOrder[]
  loading?: boolean
}

export function OrderPanels({ sellOrders, buyOrders, loading }: OrderPanelsProps) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 p-3">
      <OrderTable orders={sellOrders} type="sell" loading={loading} />
      <OrderTable orders={buyOrders} type="buy" loading={loading} />
    </div>
  )
}
