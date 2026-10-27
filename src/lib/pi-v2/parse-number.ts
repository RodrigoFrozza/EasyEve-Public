/**
 * Leitura de número digitado por gente — não por máquina.
 *
 * Nasceu de um bug com dinheiro real: o campo de isótopos recebeu `139,314`
 * (139.314 unidades, copiado do DOTLAN) e o app leu **139**. Em pt-BR a vírgula é
 * decimal, o navegador entregou `139.314`, e o parser do servidor arredondou para
 * baixo. O ISK/m³ do JF saiu 1000× errado — e sem nenhum aviso, porque 139 é um
 * número perfeitamente válido.
 *
 * A lição: `Number(input)` não serve para campo de formulário. O jogador digita
 * (ou cola) no formato do lugar dele, e o app tem que entender os dois.
 *
 * As regras, em ordem:
 *
 *  1. Espaços (inclusive NBSP) e apóstrofos são separadores de milhar em vários
 *     locales → saem sempre.
 *  2. Tem `.` **e** `,`: o **último** é o decimal, o outro é milhar.
 *     `1.234,56` e `1,234.56` → 1234.56.
 *  3. Só um dos dois, repetido: só pode ser milhar. `1.234.567` → 1234567.
 *  4. Só um dos dois, uma vez: **ambíguo**, e é aqui que estava o bug.
 *     - exatamente 3 dígitos depois E parte inteira diferente de zero → milhar.
 *       `139,314` → 139314. É o caso real: ninguém digita 139,314 unidades de
 *       isótopo.
 *     - qualquer outro caso → decimal. `0,005` → 0.005 (a taxa de collateral),
 *       `0,5` → 0.5, `12,75` → 12.75.
 *
 * A regra 4 tem uma ambiguidade que **não some**: `1,500` pode ser mil e
 * quinhentos ou um e meio. Escolhemos milhar, porque nos campos que usam esta
 * função (isótopos, m³, ISK/m³, teto, piso) grandezas fracionárias com 3 casas não
 * existem na prática, e a única taxa pequena de verdade — o collateral — começa
 * com zero e cai na outra metade da regra.
 */

/** Só o que pode compor um número; o resto invalida a entrada inteira. */
const ALLOWED = /^[-+]?[\d.,]*$/

/** Separadores de milhar que nunca são decimais: espaço, NBSP e apóstrofo. */
const GROUPING_ONLY = /[\s  ']/g

/**
 * Devolve o número que a pessoa quis dizer, ou `null` quando não deu para saber.
 *
 * `null` é deliberado: entrada inválida **não** vira 0. Zero é um preço, e um
 * preço que ninguém digitou é exatamente o tipo de número inventado que este
 * módulo não produz.
 */
export function parseHumanNumber(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null
  if (raw == null) return null

  const cleaned = raw.replace(GROUPING_ONLY, '')
  if (cleaned === '' || !ALLOWED.test(cleaned)) return null

  const sign = cleaned.startsWith('-') ? -1 : 1
  const digits = cleaned.replace(/^[-+]/, '')
  if (digits === '') return null

  const lastDot = digits.lastIndexOf('.')
  const lastComma = digits.lastIndexOf(',')

  let normalized: string

  if (lastDot >= 0 && lastComma >= 0) {
    // Regra 2: o separador que aparece por último é o decimal.
    const decimalSep = lastDot > lastComma ? '.' : ','
    const groupingSep = decimalSep === '.' ? ',' : '.'
    normalized = digits.split(groupingSep).join('').replace(decimalSep, '.')
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ','
    const parts = digits.split(sep)
    if (parts.length > 2) {
      // Regra 3: repetido só pode ser agrupamento de milhar.
      normalized = parts.join('')
    } else {
      const [intPart = '', fracPart = ''] = parts
      // Regra 4: 3 dígitos e parte inteira não-zero → milhar. É o caso do
      // `139,314` que originou este módulo.
      const looksLikeThousands = fracPart.length === 3 && Number(intPart) !== 0
      normalized = looksLikeThousands ? intPart + fracPart : `${intPart}.${fracPart}`
    }
  } else {
    normalized = digits
  }

  // Sobrou separador (ex.: `1..2`) ou nada de dígito: entrada quebrada.
  if (normalized === '' || normalized === '.') return null
  const value = Number(normalized)
  return Number.isFinite(value) ? sign * value : null
}

/**
 * Igual, mas só aceita valor **positivo** — o formato dos campos de frete, onde
 * vazio significa "N/A" e zero não é um termo de contrato.
 */
export function parsePositiveHumanNumber(
  raw: string | number | null | undefined
): number | null {
  const value = parseHumanNumber(raw)
  return value != null && value > 0 ? value : null
}
