'use client'

import React, { useMemo } from 'react'

interface SparklineProps {
  data?: number[]  // Keep for backward compatibility
  datasets?: { data: number[], color: string }[]
  width?: number
  height?: number
  color?: string  // Default color for single data
  className?: string
  strokeWidth?: number
}

export function Sparkline({ 
  data, 
  datasets,
  width = 200, 
  height = 40, 
  color = '#00ffff', 
  className = '',
  strokeWidth = 2
}: SparklineProps) {
  // If datasets provided, use multi-line mode
  const allDatasets = useMemo(() => {
    return datasets || (data ? [{ data, color }] : [])
  }, [datasets, data, color])
  
  const allPoints = useMemo(() => {
    // Calculate global min/max for multi-line scaling
    const flatData = allDatasets.flatMap(ds => ds.data || [])
    const globalMin = flatData.length ? Math.min(...flatData) : 0
    const globalMax = flatData.length ? Math.max(...flatData) : 0
    const globalRange = globalMax - globalMin || 1

    return allDatasets.map((dataset) => {
      const { data: d, color: c } = dataset
      if (!d || d.length < 2) return { points: '', min: globalMin, max: globalMax }
      
      const points = d.map((val, i) => {
        const x = (i / (d.length - 1)) * width
        const y = height - ((val - globalMin) / globalRange) * height
        return `${x},${y}`
      }).join(' ')
      
      return { points, min: globalMin, max: globalMax }
    })
  }, [allDatasets, width, height])

  const hasData = allDatasets.some(d => d.data && d.data.length >= 2)
  
  if (!hasData) {
    return (
      <div 
        className={`flex items-center justify-center text-[10px] text-zinc-600 font-mono tracking-widest ${className}`}
        style={{ width: '100%', height }}
      >
      </div>
    )
  }

  return (
    <div className={`relative ${className}`} style={{ width: '100%', height }}>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        <defs>
          {allDatasets.map((ds, idx) => (
            <linearGradient key={idx} id={`sparkline-gradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ds.color} stopOpacity="0.15" />
              <stop offset="100%" stopColor={ds.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        
        {/* Multi-line rendering */}
        {allPoints.map((pt, idx) => {
          const dataset = allDatasets[idx]
          if (!pt.points) return null
          
          return (
            <g key={idx}>
              {/* Fill Area - Only for the first one or if explicitly desired. 
                  In multi-line, we'll show it for all but with very low opacity to avoid mess */}
              <path
                d={`M 0,${height} L ${pt.points} L ${width},${height} Z`}
                fill={`url(#sparkline-gradient-${idx})`}
                className="transition-all duration-700"
              />
              
              {/* Line */}
              <polyline
                points={pt.points}
                fill="none"
                stroke={dataset.color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="transition-all duration-700"
                style={{
                  filter: `drop-shadow(0 0 4px ${dataset.color}44)`
                }}
              />
              
              {/* Glow point at end */}
              {dataset.data && dataset.data.length >= 2 && (
                <circle
                  cx={width}
                  cy={height - ((dataset.data[dataset.data.length - 1] - pt.min) / (pt.max - pt.min || 1)) * height}
                  r="2"
                  fill={dataset.color}
                  className="animate-pulse"
                />
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
