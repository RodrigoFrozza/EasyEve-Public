import { fireEvent, render, screen } from '@testing-library/react'
import { PiV2ItemIcon } from './PiV2ItemIcon'
import { TierBadge } from './TierBadge'
import { hubChipStyle } from './HubChip'
import { formatIsk, formatM3, formatUnitPrice, formatUnits } from '@/lib/pi-v2/format'

describe('PiV2ItemIcon', () => {
  it('teste 1 — monta a URL do CDN da CCP pelo typeId', () => {
    const { container } = render(<PiV2ItemIcon typeId={3645} name="Water" />)
    const img = container.querySelector('img')!
    expect(img.getAttribute('src')).toBe('https://images.evetech.net/types/3645/icon?size=32')
    expect(img.getAttribute('loading')).toBe('lazy')
    // O nome já aparece ao lado na UI — alt vazio evita leitura duplicada.
    expect(img.getAttribute('alt')).toBe('')
    expect(img.getAttribute('title')).toBe('Water')
  })

  it('falha de carregamento não quebra o layout — reserva o mesmo espaço', () => {
    const { container } = render(<PiV2ItemIcon typeId={3645} size={18} />)
    fireEvent.error(container.querySelector('img')!)

    expect(container.querySelector('img')).toBeNull()
    const placeholder = container.firstElementChild as HTMLElement
    expect(placeholder.style.width).toBe('18px')
    expect(placeholder.style.height).toBe('18px')
  })

  it('typeId inválido vira placeholder, não uma imagem quebrada', () => {
    const { container } = render(<PiV2ItemIcon typeId={0} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.firstElementChild).not.toBeNull()
  })

  it('respeita o tamanho pedido', () => {
    const { container } = render(<PiV2ItemIcon typeId={2875} size={24} />)
    const img = container.querySelector('img')!
    expect(img.getAttribute('width')).toBe('24')
  })
})

describe('TierBadge', () => {
  it('teste 2 — cada tier usa a sua cor', () => {
    const colorOf = (tier: 0 | 1 | 2 | 3 | 4) => {
      const { container } = render(<TierBadge tier={tier} />)
      return container.firstElementChild!.className
    }
    expect(colorOf(0)).toContain('zinc')
    expect(colorOf(1)).toContain('sky')
    expect(colorOf(2)).toContain('emerald')
    expect(colorOf(3)).toContain('violet')
    expect(colorOf(4)).toContain('pink')
  })

  it('mostra o rótulo do tier', () => {
    render(<TierBadge tier={3} />)
    expect(screen.getByText('P3')).toBeInTheDocument()
  })

  it('tier desconhecido não vira chip — melhor a ausência que um rótulo chutado', () => {
    const { container } = render(<TierBadge tier={undefined} />)
    expect(container.firstElementChild).toBeNull()
  })
})

describe('hubChipStyle', () => {
  it('região e Jita têm cor fixa', () => {
    expect(hubChipStyle('region')).toContain('sky')
    expect(hubChipStyle('jita')).toContain('emerald')
  })

  it('a cor de uma estação é estável — a mesma estação sempre a mesma cor', () => {
    expect(hubChipStyle('structure', '60003760')).toBe(hubChipStyle('structure', '60003760'))
  })

  it('estações diferentes tendem a cores diferentes', () => {
    const cores = new Set(
      ['1001', '2002', '3003', '4004'].map((id) => hubChipStyle('structure', id))
    )
    expect(cores.size).toBeGreaterThan(1)
  })
})

describe('formatação', () => {
  it('quantidade sempre com separador de milhar', () => {
    expect(formatUnits(208850)).toBe('208,850')
    expect(formatUnits(0)).toBe('0')
  })

  it('ISK ganha sufixo quando é grande, para a coluna caber', () => {
    expect(formatIsk(101_795_578)).toBe('101.80M')
    expect(formatIsk(3_750_000_000)).toBe('3.75B')
    expect(formatIsk(950)).toBe('950')
  })

  it('preço unitário mantém centavos só quando eles decidem algo', () => {
    // Water a 487,41 precisa das casas; Nano-Factory a 1.030.000 não.
    expect(formatUnitPrice(487.41)).toBe('487.41')
    expect(formatUnitPrice(1_030_000)).toBe('1,030,000')
  })

  it('m³ ganha uma casa só quando o volume é pequeno', () => {
    expect(formatM3(0.19)).toBe('0.2')
    expect(formatM3(340_035)).toBe('340,035')
  })

  it('valor não-finito não vira NaN na tela', () => {
    expect(formatUnits(Number.NaN)).toBe('0')
    expect(formatIsk(Number.NaN)).toBe('0')
    expect(formatUnitPrice(Number.NaN)).toBe('—')
    expect(formatM3(Number.NaN)).toBe('0')
  })
})
