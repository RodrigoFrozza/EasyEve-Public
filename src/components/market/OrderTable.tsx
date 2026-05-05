'use client'

import React from 'react'
import { cn, formatISK } from '@/lib/utils'
import { MarketOrder } from '@/lib/constants/market'
import { motion } from 'framer-motion'

interface OrderTableProps {
  orders: MarketOrder[]
  type: 'sell' | 'buy'
  loading?: boolean
}

export function OrderTable({ orders, type, loading }: OrderTableProps) {
  const isSell = type === 'sell'
  const headerBg = isSell ? 'bg-emerald-500/10' : 'bg-cyan-500/10'
  const headerText = isSell ? 'text-emerald-400' : 'text-cyan-400'
  const rowHover = isSell ? 'hover:bg-emerald-500/5' : 'hover:bg-cyan-500/5'
  const priceColor = isSell ? 'text-emerald-400' : 'text-cyan-400'
  const accentColor = isSell ? 'bg-emerald-500' : 'bg-cyan-500'

  if (loading) {
    return (
      <div className="flex flex-col bg-zinc-950/20 rounded-2xl overflow-hidden border border-white/5">
        <div className={cn('px-6 py-4 flex items-center justify-between border-b border-white/5', headerBg)}>
          <div className="flex items-center gap-3">
            <div className={cn('w-2 h-2 rounded-full animate-pulse', accentColor)} />
            <span className={cn('text-xs font-black uppercase tracking-[0.2em] font-outfit', headerText)}>
              {isSell ? 'Sell Orders' : 'Buy Orders'}
            </span>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex gap-4 items-center">
              <div className="w-24 h-4 bg-white/5 rounded animate-pulse" />
              <div className="w-16 h-4 bg-white/5 rounded animate-pulse" />
              <div className="flex-1 h-4 bg-white/5 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-zinc-950/20 rounded-3xl overflow-hidden border border-white/5 transition-all hover:border-white/10 group/table">
      <div className={cn('px-6 py-4 flex items-center justify-between border-b border-white/5 transition-colors', headerBg)}>
        <div className="flex items-center gap-3">
          <div className={cn('w-2 h-2 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]', accentColor, isSell ? 'shadow-emerald-500/50' : 'shadow-cyan-500/50')} />
          <span className={cn('text-xs font-black uppercase tracking-[0.2em] font-outfit', headerText)}>
            {isSell ? 'Sell Orders' : 'Buy Orders'}
          </span>
        </div>
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest bg-black/20 px-2 py-0.5 rounded-md">
          {orders.length} ACTIVE
        </span>
      </div>
      
      <div className="p-4">
        <div className="flex gap-4 px-3 py-2 text-[10px] font-black text-gray-600 uppercase tracking-widest border-b border-white/5 mb-2">
          <span className="w-32">Price (ISK)</span>
          <span className="w-20">Quantity</span>
          <span className="flex-1">Location</span>
        </div>
        
        <div className="space-y-0.5 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
          {orders.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-xs font-bold text-gray-600 uppercase tracking-widest">No Active Orders</p>
            </div>
          ) : (
            orders.map((order, idx) => (
              <motion.div
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(idx * 0.03, 0.5) }}
                key={order.order_id}
                className={cn('flex gap-4 px-3 py-2.5 text-xs rounded-xl transition-all cursor-default group/row', rowHover)}
              >
                <span className={cn('w-32 font-mono font-bold tracking-tight', priceColor)}>
                  {formatISK(order.price)}
                </span>
                <span className="w-20 text-gray-400 font-bold">
                  {order.volume_remain.toLocaleString()}
                </span>
                <span className="flex-1 text-gray-500 truncate font-medium group-hover/row:text-gray-300 transition-colors" title={order.location_name}>
                  {order.location_name || `Station ${order.location_id}`}
                </span>
              </motion.div>
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
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 p-6">
      <OrderTable orders={sellOrders} type="sell" loading={loading} />
      <OrderTable orders={buyOrders} type="buy" loading={loading} />
    </div>
  )
}