/**
 * O parser de número digitado.
 *
 * O caso que originou o módulo está no primeiro teste: `139,314` copiado do
 * DOTLAN era lido como **139**, e o ISK/m³ do JF saía 1000× errado sem nenhum
 * aviso — porque 139 é um número perfeitamente plausível.
 */

import { parseHumanNumber, parsePositiveHumanNumber } from '@/lib/pi-v2/parse-number'

describe('teste 1 — o bug: 139.314 isótopos, nos três formatos', () => {
  it('lê os três como 139314', () => {
    expect(parseHumanNumber('139.314')).toBe(139_314)
    expect(parseHumanNumber('139,314')).toBe(139_314)
    expect(parseHumanNumber('139314')).toBe(139_314)
  })

  it('nunca lê 139,314 como 139 — era o bug', () => {
    expect(parseHumanNumber('139,314')).not.toBe(139)
    expect(parseHumanNumber('139.314')).not.toBe(139)
  })
})

describe('a taxa de collateral continua decimal (0,5%)', () => {
  it('0,005 e 0.005 são cinco milésimos, não 5', () => {
    // A regra do milhar exige parte inteira não-zero justamente por isto.
    expect(parseHumanNumber('0,005')).toBe(0.005)
    expect(parseHumanNumber('0.005')).toBe(0.005)
  })

  it('frações pequenas com menos de 3 casas também sobrevivem', () => {
    expect(parseHumanNumber('0,5')).toBe(0.5)
    expect(parseHumanNumber('0.5')).toBe(0.5)
    expect(parseHumanNumber('0,05')).toBe(0.05)
  })
})

describe('milhar repetido só pode ser agrupamento', () => {
  it('1.234.567 e 1,234,567 são o mesmo número', () => {
    expect(parseHumanNumber('1.234.567')).toBe(1_234_567)
    expect(parseHumanNumber('1,234,567')).toBe(1_234_567)
  })

  it('a carga cheia de um freighter, como se digita', () => {
    expect(parseHumanNumber('340.000')).toBe(340_000)
    expect(parseHumanNumber('340,000')).toBe(340_000)
    expect(parseHumanNumber('340000')).toBe(340_000)
  })
})

describe('os dois separadores juntos: o último manda', () => {
  it('formato BR e formato US dão o mesmo valor', () => {
    expect(parseHumanNumber('1.234,56')).toBeCloseTo(1234.56, 10)
    expect(parseHumanNumber('1,234.56')).toBeCloseTo(1234.56, 10)
  })

  it('reward de contrato com centavos', () => {
    expect(parseHumanNumber('280.000.000,50')).toBeCloseTo(280_000_000.5, 6)
    expect(parseHumanNumber('280,000,000.50')).toBeCloseTo(280_000_000.5, 6)
  })
})

describe('espaço e apóstrofo são separador de milhar em vários lugares', () => {
  it('some sem virar erro', () => {
    expect(parseHumanNumber('340 000')).toBe(340_000)
    // NBSP: é o que o Intl.NumberFormat de pt-BR/fr produz ao formatar.
    expect(parseHumanNumber('340 000')).toBe(340_000)
    expect(parseHumanNumber("340'000")).toBe(340_000)
  })
})

describe('entrada inválida devolve null, nunca 0', () => {
  it('vazio, texto e lixo não viram preço', () => {
    // Zero é um preço. Um preço que ninguém digitou é número inventado.
    for (const raw of ['', '   ', 'abc', '1.2.3,4,5', '.', ',', '-', '1e5x', 'R$ 850']) {
      expect(parseHumanNumber(raw)).toBeNull()
    }
  })

  it('número já numérico passa direto; NaN e Infinity não', () => {
    expect(parseHumanNumber(139_314)).toBe(139_314)
    expect(parseHumanNumber(0)).toBe(0)
    expect(parseHumanNumber(Number.NaN)).toBeNull()
    expect(parseHumanNumber(Number.POSITIVE_INFINITY)).toBeNull()
    expect(parseHumanNumber(null)).toBeNull()
    expect(parseHumanNumber(undefined)).toBeNull()
  })
})

describe('a variante que só aceita positivo (os campos de frete)', () => {
  it('zero e negativo viram null — vazio significa "N/A", não "custa zero"', () => {
    expect(parsePositiveHumanNumber('0')).toBeNull()
    expect(parsePositiveHumanNumber('0,00')).toBeNull()
    expect(parsePositiveHumanNumber('-850')).toBeNull()
    expect(parsePositiveHumanNumber('850')).toBe(850)
    expect(parsePositiveHumanNumber('0,005')).toBe(0.005)
  })
})

describe('a ambiguidade que não some, documentada', () => {
  it('1,500 é lido como mil e quinhentos, não como um e meio', () => {
    // Escolha consciente: nos campos que usam esta função (isótopos, m³, ISK/m³,
    // teto, piso) fração de 3 casas não existe na prática.
    expect(parseHumanNumber('1,500')).toBe(1500)
    expect(parseHumanNumber('1.500')).toBe(1500)
    // Quem quer um e meio tem duas casas, e aí não há ambiguidade.
    expect(parseHumanNumber('1,50')).toBe(1.5)
  })
})
