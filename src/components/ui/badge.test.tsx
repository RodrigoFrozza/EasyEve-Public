import { render, screen } from '@testing-library/react'
import { Badge, badgeVariants } from './badge'

describe('Badge', () => {
  describe('badgeVariants', () => {
    it('should return default variant classes', () => {
      expect(badgeVariants({})).toContain('bg-primary')
    })

    it('should return secondary variant classes', () => {
      expect(badgeVariants({ variant: 'secondary' })).toContain('bg-secondary')
    })

    it('should return destructive variant classes', () => {
      expect(badgeVariants({ variant: 'destructive' })).toContain('bg-destructive')
    })

    it('should return outline variant classes', () => {
      expect(badgeVariants({ variant: 'outline' })).toContain('text-foreground')
    })

    it('should return eve variant classes', () => {
      expect(badgeVariants({ variant: 'eve' })).toContain('bg-eve-accent')
    })

    it('should return success variant classes', () => {
      expect(badgeVariants({ variant: 'success' })).toContain('bg-green-600')
    })

    it('should return warning variant classes', () => {
      expect(badgeVariants({ variant: 'warning' })).toContain('bg-yellow-600')
    })
  })

  describe('Badge component', () => {
    it('should render with default variant', () => {
      render(<Badge>Default</Badge>)
      expect(screen.getByText('Default')).toBeTruthy()
    })

    it('should render with custom variant', () => {
      render(<Badge variant="eve">Custom</Badge>)
      expect(screen.getByText('Custom')).toBeTruthy()
    })

    it('should merge custom className', () => {
      render(<Badge className="custom-class">Test</Badge>)
      expect(screen.getByText('Test').className).toContain('custom-class')
    })
  })
})