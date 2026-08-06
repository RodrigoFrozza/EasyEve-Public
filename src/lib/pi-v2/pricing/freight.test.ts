/**
 * Fórmula do frete contratado.
 *
 * Os números vêm de contratos reais do Rodrigo (GDSO e ITL, rodadas de 20-21/07
 * registradas no vault), não de exemplos inventados:
 *
 *  - GDSO, 292.485 m³ a 800 ISK/m³ → reward 234M
 *  - GDSO, 169.218,8 m³ → reward 136.000.000 (803,69 ISK/m³), collateral 2,27B
 *  - ITL cobra ~5% a mais que a GDSO nas mesmas cargas
 *
 * A regra que estes testes travam: **termo "N/A" sai da conta, não vira zero.**
 * Zero é um preço; ausência é uma regra que aquele contrato não tem. Confundir
 * os dois faria "Flat Rate Only" custar nada por m³.
 */

import { contractReward, marginalRatePerM3, type ContractFreight } from '@/lib/pi-v2/pricing/freight'

const gdso: ContractFreight = { transporter: 'GDSO', perM3Rate: 800 }

describe('contractReward — qual termo vence', () => {
  it('per m³ manda quando não há teto nem piso maiores', () => {
    // Contrato real: 292.485 m³ × 800 = 233,99M ≈ os 234M cobrados.
    const r = contractReward({ volumeM3: 292_485, collateralValue: 3_960_000_000, contract: gdso })
    expect(r.reward).toBeCloseTo(233_988_000, 0)
    expect(r.binding).toBe('per_m3')
  })

  it('o full load é TETO: carga grande para de escalar', () => {
    const contract: ContractFreight = { ...gdso, fullLoadReward: 250_000_000 }
    // 350.000 × 800 = 280M, acima do teto de 250M.
    const r = contractReward({ volumeM3: 350_000, collateralValue: 4_000_000_000, contract })
    expect(r.reward).toBe(250_000_000)
    expect(r.binding).toBe('full_load')
  })

  it('abaixo do teto, o per m³ volta a mandar', () => {
    const contract: ContractFreight = { ...gdso, fullLoadReward: 250_000_000 }
    const r = contractReward({ volumeM3: 100_000, collateralValue: 1_000_000_000, contract })
    expect(r.reward).toBe(80_000_000)
    expect(r.binding).toBe('per_m3')
  })

  it('a taxa de collateral é PISO: carga pequena e valiosa paga por valor', () => {
    // 0,5% de 10B = 50M; 10.000 m³ × 800 = 8M. O collateral ganha.
    const contract: ContractFreight = { ...gdso, collateralRate: 0.005 }
    const r = contractReward({ volumeM3: 10_000, collateralValue: 10_000_000_000, contract })
    expect(r.reward).toBe(50_000_000)
    expect(r.binding).toBe('collateral')
  })

  it('carga grande e barata: o volume ganha do collateral', () => {
    // Contrato real: 0,5% de 2,27B = 11,4M contra 136M por volume.
    const contract: ContractFreight = { ...gdso, collateralRate: 0.005, perM3Rate: 803.69 }
    const r = contractReward({ volumeM3: 169_218.8, collateralValue: 2_272_107_995, contract })
    expect(r.reward).toBeCloseTo(136_000_000, -4)
    expect(r.binding).toBe('per_m3')
  })
})

describe('termos "N/A" saem da conta', () => {
  it('"Use Volume" (sem collateral) não paga nada por valor', () => {
    const contract: ContractFreight = { transporter: 'X', perM3Rate: 800, collateralRate: null }
    const r = contractReward({ volumeM3: 1_000, collateralValue: 50_000_000_000, contract })
    expect(r.reward).toBe(800_000)
    expect(r.binding).toBe('per_m3')
  })

  it('"Flat Rate Only" (sem per m³) cobra o full load, não zero', () => {
    // O erro que este teste impede: tratar `perM3Rate` ausente como 0 e concluir
    // que a viagem é grátis.
    const contract: ContractFreight = {
      transporter: 'X',
      perM3Rate: null,
      fullLoadReward: 180_000_000,
    }
    const r = contractReward({ volumeM3: 1_000, collateralValue: 1_000_000, contract })
    expect(r.reward).toBe(180_000_000)
    expect(r.binding).toBe('full_load')
  })

  it('contrato em branco não vira frete 0 em silêncio — sai marcado', () => {
    const r = contractReward({
      volumeM3: 100_000,
      collateralValue: 1_000_000_000,
      contract: { transporter: 'X' },
    })
    expect(r.unpriced).toBe(true)
    expect(r.binding).toBe('none')
  })
})

describe('min reward é piso de tudo', () => {
  const contract: ContractFreight = { ...gdso, minReward: 20_000_000 }

  it('carga pequena paga o piso', () => {
    // 1.000 m³ × 800 = 800k, abaixo do piso de 20M.
    const r = contractReward({ volumeM3: 1_000, collateralValue: 10_000_000, contract })
    expect(r.reward).toBe(20_000_000)
    expect(r.binding).toBe('min_reward')
  })

  it('carga grande passa do piso e ele não interfere', () => {
    const r = contractReward({ volumeM3: 100_000, collateralValue: 10_000_000, contract })
    expect(r.reward).toBe(80_000_000)
    expect(r.binding).toBe('per_m3')
  })

  it('o piso também cobre quando só existe ele', () => {
    const r = contractReward({
      volumeM3: 100,
      collateralValue: 0,
      contract: { transporter: 'X', minReward: 5_000_000 },
    })
    expect(r.reward).toBe(5_000_000)
    expect(r.binding).toBe('min_reward')
  })
})

describe('marginalRatePerM3 — o que decide de onde vem cada item', () => {
  it('usa o per m³ publicado', () => {
    expect(marginalRatePerM3(gdso)).toBe(800)
  })

  it('só full load: rateia pelo volume da carga cheia', () => {
    expect(
      marginalRatePerM3({
        transporter: 'X',
        perM3Rate: null,
        fullLoadReward: 280_000_000,
        fullLoadVolumeM3: 350_000,
      })
    ).toBeCloseTo(800, 6)
  })

  it('full load SEM o volume dele → null, não um número chutado', () => {
    // Sem saber o que a transportadora chama de "carga cheia", não dá para dizer
    // quanto do frete cabe a cada unidade. A UI avisa; a gente não inventa.
    expect(
      marginalRatePerM3({ transporter: 'X', perM3Rate: null, fullLoadReward: 280_000_000 })
    ).toBeNull()
  })

  it('contrato em branco → null', () => {
    expect(marginalRatePerM3({ transporter: 'X' })).toBeNull()
  })

  it('o teto do full load NÃO entra na taxa marginal', () => {
    // Se entrasse, um item mudaria de hub conforme o resto da lista crescesse.
    expect(marginalRatePerM3({ ...gdso, fullLoadReward: 1 })).toBe(800)
  })
})
