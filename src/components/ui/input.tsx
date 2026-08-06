import * as React from 'react'
import { cn } from '@/lib/utils'

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded-sm border border-eve-border bg-eve-panel px-3 py-2 text-sm text-eve-text ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-eve-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-eve-accent focus-visible:border-eve-accent/40 disabled:cursor-not-allowed disabled:opacity-50 transition-colors',
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = 'Input'

export { Input }
