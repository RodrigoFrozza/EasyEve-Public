'use client'

import { useState, useEffect } from 'react'
import { Toaster as SonnerToaster } from 'sonner'

export function Toaster() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <SonnerToaster 
      theme="dark" 
      position="bottom-right"
      toastOptions={{
        style: {
          background: '#1a1a2e',
          border: '1px solid #333',
          color: '#fff',
        },
      }}
    />
  )
}