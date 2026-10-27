import { render, screen, fireEvent } from '@testing-library/react'
import { CharacterProfileView } from './CharacterProfileView'
import type { SharedProfileDto } from '@/lib/characters/share-profile'

// Real pt-BR strings, resolved from the actual locale file, so the smoke test
// checks the actual copy ("Sem treino ativo") rather than a made-up stand-in.
// Kept self-contained inside the factory (no out-of-scope var reference) per
// jest's mock-hoisting rules.
jest.mock('@/i18n/hooks', () => {
  const ptBR = require('@/i18n/locales/pt-BR.json')
  function resolve(key: string): string {
    const value = key
      .split('.')
      .reduce((acc: any, k: string) => (acc && typeof acc === 'object' ? acc[k] : undefined), ptBR)
    return typeof value === 'string' ? value : key
  }
  return {
    useTranslations: () => ({
      locale: 'pt-BR',
      t: (key: string, params?: Record<string, string | number>) => {
        let text = resolve(key)
        if (params) {
          text = text.replace(/\{(\w+)\}/g, (_: string, k: string) => String(params[k] ?? `{${k}}`))
        }
        return text
      },
    }),
  }
})

// These hooks use react-query internally; mock them directly instead of
// wrapping the tree in a QueryClientProvider, since this is a pure smoke test.
jest.mock('@/lib/hooks/use-corporation-info', () => ({
  useCorporationInfo: () => ({ data: undefined }),
}))
jest.mock('@/lib/hooks/use-skill-catalog', () => ({
  useSkillCatalog: () => ({ data: undefined, isLoading: false }),
}))
jest.mock('@/lib/hooks/use-type-names', () => ({
  useTypeNames: () => ({ data: undefined }),
}))

function minimalProfile(overrides: Partial<SharedProfileDto> = {}): SharedProfileDto {
  return {
    name: 'Pilot Alpha',
    characterId: 900001,
    corporationId: null,
    birthday: null,
    raceId: null,
    bloodlineId: null,
    gender: null,
    securityStatus: null,
    isOmega: null,
    totalSp: null,
    unallocatedSp: null,
    skills: [],
    skillqueue: [],
    attributes: null,
    implants: [],
    capturedAt: null,
    ...overrides,
  }
}

describe('CharacterProfileView', () => {
  it('renders a minimal DTO without crashing and shows "sem treino ativo" for an empty skill queue', () => {
    render(<CharacterProfileView profile={minimalProfile()} />)

    expect(screen.getByText('Pilot Alpha')).toBeInTheDocument()
    // The training section is expanded by default, so the empty-queue copy
    // appears twice: once as the always-visible collapsed-header summary,
    // once as the body's empty state inside the (open) collapsible content.
    const emptyTrainingMatches = screen.getAllByText('Sem treino ativo')
    expect(emptyTrainingMatches.length).toBeGreaterThanOrEqual(1)
  })

  it('keeps skills and attributes collapsed by default, expanding on click', () => {
    render(<CharacterProfileView profile={minimalProfile()} />)

    const trainingToggle = screen.getByRole('button', { name: /Em treinamento/ })
    const skillsToggle = screen.getByRole('button', { name: /Skills treinadas/ })
    const attributesToggle = screen.getByRole('button', { name: /Atributos & Remap/ })

    expect(trainingToggle).toHaveAttribute('aria-expanded', 'true')
    expect(skillsToggle).toHaveAttribute('aria-expanded', 'false')
    expect(attributesToggle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(skillsToggle)
    expect(skillsToggle).toHaveAttribute('aria-expanded', 'true')
  })

  it('renders the loading skeleton when loading (no profile to read from yet)', () => {
    const { container } = render(<CharacterProfileView profile={null} loading />)

    expect(screen.queryByText('Pilot Alpha')).not.toBeInTheDocument()
    expect(container.firstChild).not.toBeNull()
  })
})
