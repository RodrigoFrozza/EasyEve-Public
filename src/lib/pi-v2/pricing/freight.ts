/**
 * Contrato de courier — como o jogador realmente chega no custo de contratar
 * alguém para trazer a carga. (O modelo completo, com base central e hubs de
 * vários métodos, mora em `freight-model.ts`, que consome estas funções.)
 *
 * O `ISK/m³` genérico das etapas anteriores é a média; ele não é como o preço se
 * forma. Um contrato de courier tem **teto** (full load) e **piso** (min reward
 * e taxa de collateral), então o total não é `volume × per_m3` — e quando o teto
 * ou o piso morde, o jogador precisa ver por quê.
 *
 * A fórmula real (confirmada contra a ITL):
 *
 *     Reward = MAX( collateral_rate × collateral,
 *                   MIN( full_load_flat_rate, volume × per_m3_rate ) )
 *     Reward = MAX( min_reward, Reward )
 *
 * Termos "N/A" da tabela da transportadora **saem da conta**, não viram zero:
 *  - "Use Volume"      → sem termo de collateral
 *  - "Flat Rate Only"  → sem `per_m3`, só o full load
 *
 * Puro e sem dependências: é importado por componente de cliente e por servidor.
 */

/**
 * Uma transportadora numa rota. Os campos nulos são os "N/A" da tabela dela —
 * ausência de termo, não zero. Zero seria um preço; ausência é uma regra que não
 * existe naquele contrato.
 */
export interface ContractFreight {
  /** "ITL", "GDSO", ... — nome que o jogador dá. */
  transporter: string
  /** ISK por m³. null = "Flat Rate Only". */
  perM3Rate?: number | null
  /** Taxa fixa da carga cheia. null = N/A. */
  fullLoadReward?: number | null
  /**
   * m³ que a transportadora considera "carga cheia". Necessário para atribuir o
   * full load por item quando não há `perM3Rate` — sem ele, não dá para dizer
   * quanto do frete cabe a cada unidade, e a gente NÃO inventa.
   */
  fullLoadVolumeM3?: number | null
  /** Fração do collateral (ex.: 0,005 = 0,5%). null = "Use Volume". */
  collateralRate?: number | null
  /** Piso do contrato. */
  minReward?: number | null
}

/** Qual termo da fórmula determinou o valor — a UI mostra isto ao jogador. */
export type RewardBinding = 'min_reward' | 'collateral' | 'full_load' | 'per_m3' | 'none'

export interface ContractRewardResult {
  reward: number
  binding: RewardBinding
  /** true quando nenhum termo pôde ser calculado (contrato em branco). */
  unpriced: boolean
}

function positive(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null
}

/**
 * Reward completo do contrato para um envio — o custo REAL, com teto e piso.
 *
 * É o que vai no total do hub. A escolha de hub por item continua usando a taxa
 * marginal (ver `marginalRatePerM3`): o teto do full load não pode influenciar
 * de onde vem um item individual, senão o item mudaria de hub conforme o resto
 * da lista crescesse.
 */
export function contractReward(input: {
  volumeM3: number
  /** Valor da carga — vira a base do termo de collateral. */
  collateralValue: number
  contract: ContractFreight
}): ContractRewardResult {
  const { volumeM3, collateralValue, contract } = input

  const perM3 = positive(contract.perM3Rate)
  const fullLoad = positive(contract.fullLoadReward)
  const collateralRate = positive(contract.collateralRate)
  const minReward = positive(contract.minReward)

  const byVolume = perM3 != null ? volumeM3 * perM3 : null
  // MIN(full load, volume × per m³) — com um termo ausente, sobra o outro.
  let inner: number | null
  let innerBinding: RewardBinding
  if (byVolume != null && fullLoad != null) {
    inner = Math.min(fullLoad, byVolume)
    innerBinding = fullLoad < byVolume ? 'full_load' : 'per_m3'
  } else if (byVolume != null) {
    inner = byVolume
    innerBinding = 'per_m3'
  } else if (fullLoad != null) {
    inner = fullLoad
    innerBinding = 'full_load'
  } else {
    inner = null
    innerBinding = 'none'
  }

  const byCollateral = collateralRate != null ? collateralRate * collateralValue : null

  let reward: number | null = inner
  let binding: RewardBinding = innerBinding
  if (byCollateral != null && (reward == null || byCollateral > reward)) {
    reward = byCollateral
    binding = 'collateral'
  }

  if (reward == null) {
    // Nem volume, nem full load, nem collateral: só o piso, se houver. Contrato
    // em branco não vira frete 0 em silêncio — sai marcado.
    if (minReward != null) return { reward: minReward, binding: 'min_reward', unpriced: false }
    return { reward: 0, binding: 'none', unpriced: true }
  }

  if (minReward != null && minReward > reward) {
    return { reward: minReward, binding: 'min_reward', unpriced: false }
  }
  return { reward, binding, unpriced: false }
}

/**
 * Taxa marginal em ISK/m³ — o que escala com cada item, e portanto o que decide
 * de ONDE vem cada item.
 *
 *  - `perM3Rate` publicado → é ele.
 *  - só full load, mas com o volume da carga cheia → rateia (`full / volume`).
 *  - nada disso → `null`. **Não inventamos taxa**: a UI avisa que o frete desta
 *    estação não é atribuível por item, e a escolha de hub a trata como 0 — mas
 *    o jogador sabe disso, em vez de ver um número que ninguém calculou.
 */
export function marginalRatePerM3(contract: ContractFreight): number | null {
  const perM3 = positive(contract.perM3Rate)
  if (perM3 != null) return perM3

  const fullLoad = positive(contract.fullLoadReward)
  const fullLoadVolume = positive(contract.fullLoadVolumeM3)
  if (fullLoad != null && fullLoadVolume != null) return fullLoad / fullLoadVolume

  return null
}
