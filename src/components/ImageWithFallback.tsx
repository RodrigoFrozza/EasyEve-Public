'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'

interface ImageWithFallbackProps {
  src: string
  alt: string
  width?: number
  height?: number
  className?: string
  priority?: boolean
}

function probeWithImage(base: string): Promise<string | null> {
  return new Promise((resolve) => {
    const tryExt = (ext: 'png' | 'jpg') => {
      const url = `/frontpage/${base}.${ext}`
      const img = new window.Image()
      img.onload = () => resolve(url)
      img.onerror = () => {
        if (ext === 'png') tryExt('jpg')
        else resolve(null)
      }
      img.src = url
    }
    tryExt('png')
  })
}

export function ImageWithFallback({
  src,
  alt,
  width = 800,
  height = 600,
  className = '',
  priority = false,
}: ImageWithFallbackProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function resolveSrc() {
      for (const ext of ['png', 'jpg'] as const) {
        const url = `/frontpage/${src}.${ext}`
        try {
          const res = await fetch(url, { method: 'HEAD' })
          if (cancelled) return
          if (res.ok) {
            setImageSrc(url)
            setIsLoading(false)
            return
          }
        } catch {
          // try next extension or fallback
        }
      }

      if (cancelled) return
      const fallback = await probeWithImage(src)
      if (cancelled) return
      if (fallback) {
        setImageSrc(fallback)
        setIsLoading(false)
        return
      }
      setHasError(true)
      setIsLoading(false)
    }

    void resolveSrc()

    return () => {
      cancelled = true
    }
  }, [src])

  if (isLoading) {
    return (
      <div
        className={`bg-eve-panel animate-pulse rounded-xl ${className}`}
        style={{ width, height }}
      />
    )
  }

  if (hasError || !imageSrc) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`relative bg-gradient-to-br from-eve-panel to-eve-dark rounded-xl border border-eve-border/30 overflow-hidden ${className}`}
        style={{ width, height }}
      >
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(0, 212, 255, 0.1) 1px, transparent 1px),
              linear-gradient(90deg, rgba(0, 212, 255, 0.1) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
          }}
        />

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <svg
              className="w-16 h-16 mx-auto text-eve-accent/50 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-gray-500 text-sm">{alt}</p>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={`relative rounded-xl overflow-hidden ${className}`}
      style={{ width, height }}
    >
      <Image
        src={imageSrc}
        alt={alt}
        fill
        className="object-cover"
        priority={priority}
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
    </motion.div>
  )
}
