'use client'

import React, { useMemo } from 'react'

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
  color?: string
  className?: string
  strokeWidth?: number
}

export function Sparkline({ 
  data, 
  width = 200, 
  height = 40, 
  color = '#00ffff', 
  className = '',
  strokeWidth = 2
}: SparklineProps) {
  const points = useMemo(() => {
    if (!data || data.length < 2) return ''
    
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    
    return data.map((val, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - ((val - min) / range) * height
      return `${x},${y}`
    }).join(' ')
  }, [data, width, height])

  if (!data || data.length < 2) {
    return (
      <div 
        className={`flex items-center justify-center text-[10px] text-zinc-600 font-mono tracking-widest ${className}`}
        style={{ width, height }}
      >
      </div>
    )
  }

  return (
    <div className={`relative ${className}`} style={{ width, height }}>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <defs>
          <linearGradient id="sparkline-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.2" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        
        {/* Fill Area */}
        <path
          d={`M 0,${height} L ${points} L ${width},${height} Z`}
          fill="url(#sparkline-gradient)"
          className="transition-all duration-700"
        />
        
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-700"
          style={{
            filter: `drop-shadow(0 0 4px ${color}44)`
          }}
        />
        
        {/* Glow point at end */}
        <circle
          cx={(data.length - 1) / (data.length - 1) * width}
          cy={height - ((data[data.length - 1] - Math.min(...data)) / (Math.max(...data) - Math.min(...data) || 1)) * height}
          r="2"
          fill={color}
          className="animate-pulse"
        />
      </svg>
    </div>
  )
}
