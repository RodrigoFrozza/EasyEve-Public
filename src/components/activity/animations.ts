import { Variants } from 'framer-motion'

export const animations = {
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  } as Variants,
  
  fadeInUp: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
  } as Variants,
  
  fadeInLeft: {
    initial: { opacity: 0, x: -20 },
    animate: { opacity: 1, x: 0 },
  } as Variants,
  
  scaleIn: {
    initial: { opacity: 0, scale: 0.95 },
    animate: { opacity: 1, scale: 1 },
  } as Variants,
  
  stagger: (delay: number = 0) => ({
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { delay: delay * 0.05, duration: 0.3 }
  }) as Variants,
  
  collapse: {
    initial: { height: 0, opacity: 0 },
    animate: { height: 'auto', opacity: 1 },
    exit: { height: 0, opacity: 0 },
  } as Variants,
}

export const transition = {
  fast: { duration: 0.2 },
  default: { duration: 0.3 },
  slow: { duration: 0.5 },
  spring: { type: 'spring' as const, stiffness: 220, damping: 20 },
}

export const hoverEffects = {
  scale: 'scale-105',
  border: 'border-white/10',
  glow: 'shadow-lg shadow-blue-500/5',
}