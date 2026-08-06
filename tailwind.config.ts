import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)'],
        accent: ['var(--font-accent)'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Teal Aurora accent (themeable via --acc / --acc-soft)
        acc: {
          DEFAULT: 'var(--acc)',
          soft: 'var(--acc-soft)',
        },
        // Teal Aurora design tokens (surfaces / text ramp / semantic / activity)
        ta: {
          bg: 'var(--ta-bg)',
          sidebar: 'var(--ta-sidebar)',
          'sidebar-footer': 'var(--ta-sidebar-footer)',
          inset: 'var(--ta-inset)',
          header: 'var(--ta-header)',
          'row-hover': 'var(--ta-row-hover)',
          'card-hover': 'var(--ta-card-hover)',
          heading: 'var(--ta-heading)',
          body: 'var(--ta-body)',
          bright: 'var(--ta-bright)',
          secondary: 'var(--ta-secondary)',
          muted: 'var(--ta-muted)',
          faint: 'var(--ta-faint)',
          success: 'var(--ta-success)',
          'success-dot': 'var(--ta-success-dot)',
          warning: 'var(--ta-warning)',
          gold: 'var(--ta-gold)',
          danger: 'var(--ta-danger)',
          info: 'var(--ta-info)',
          violet: 'var(--ta-violet)',
        },
        eve: {
          bg: '#0f1923',
          dark: '#0a1119',
          panel: '#141e2b',
          'panel-light': '#1a2736',
          border: '#1e3044',
          'border-light': '#2a4060',
          accent: 'hsl(var(--eve-accent) / <alpha-value>)',
          'accent-dim': 'hsl(var(--eve-accent-dim) / <alpha-value>)',
          accent2: '#e8a033',
          text: '#c8d6e0',
          muted: '#5a7080',
          highlight: 'hsl(var(--eve-highlight) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 1px)',
        sm: 'calc(var(--radius) - 2px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
