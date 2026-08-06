/**
 * Formatação de número da tela do PI v2.
 *
 * Existe para a mesma grandeza aparecer sempre igual: quantidade com separador
 * de milhar, ISK com sufixo quando é grande, m³ com uma casa só quando ela
 * informa algo. Coluna numérica com formatos misturados obriga a reler cada
 * linha — o oposto do que esta passada quer.
 *
 * Puro e sem dependência: é importado por componente de cliente.
 */

/** Inteiros com separador de milhar. Usado em quantidade e unidades. */
export function formatUnits(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Math.round(value).toLocaleString('en-US')
}

/**
 * ISK: sufixo K/M/B acima de mil, senão o número inteiro. Duas casas no sufixo —
 * uma só já esconde diferença que importa em custo de bilhões.
 */
export function formatIsk(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0'
  const sign = value < 0 ? '-' : ''
  const abs = Math.abs(value)
  if (abs >= 1_000_000_000) return `${sign}${(abs / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `${sign}${Math.round(abs).toLocaleString('en-US')}`
  return `${sign}${Math.round(abs).toLocaleString('en-US')}`
}

/**
 * Preço unitário: sem sufixo (o jogador compara com o book, que mostra o valor
 * cheio), com casas decimais só quando o item é barato o bastante para elas
 * mudarem a decisão — Water a 487,41 precisa; Nano-Factory a 1.030.000 não.
 */
export function formatUnitPrice(value: number): string {
  if (!Number.isFinite(value)) return '—'
  if (value === 0) return '0'
  if (Math.abs(value) < 1000) {
    return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }
  return Math.round(value).toLocaleString('en-US')
}

/** m³ com uma casa quando o volume é pequeno; inteiro quando é carga. */
export function formatM3(value: number): string {
  if (!Number.isFinite(value)) return '0'
  if (Math.abs(value) > 0 && Math.abs(value) < 10) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 1 })
  }
  return Math.round(value).toLocaleString('en-US')
}
