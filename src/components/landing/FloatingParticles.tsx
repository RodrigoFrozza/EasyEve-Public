'use client'

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'

interface Particle {
  id: number
  initialX: number
  duration: number
  delay: number
}

const PARTICLE_COUNT = 4

export function FloatingParticles() {
  const prefersReducedMotion = usePrefersReducedMotion()
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    const generated: Particle[] = Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
      id: i,
      initialX: Math.random() * 100,
      duration: 15 + i * 2,
      delay: i * 0.5,
    }))
    setParticles(generated)
  }, [])

  if (prefersReducedMotion) {
    return null
  }

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          className="absolute w-1 h-1 bg-eve-accent/60 rounded-full"
          initial={{
            x: `${particle.initialX}%`,
            y: '110%',
          }}
          animate={{
            y: '-10%',
            x: `calc(${particle.initialX}% + ${Math.sin(particle.id) * 200}px)`,
          }}
          transition={{
            duration: particle.duration,
            repeat: Infinity,
            ease: 'linear',
            delay: particle.delay,
          }}
          style={{
            opacity: 0.6,
          }}
        />
      ))}
    </div>
  )
}