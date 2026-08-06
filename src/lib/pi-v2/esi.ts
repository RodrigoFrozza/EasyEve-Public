/**
 * Contrato da ESI de Planetary Interaction — as formas cruas que o motor consome.
 *
 * São três endpoints, todos GET (a ESI de PI é read-only; nenhuma ferramenta
 * reinicia extrator ou muda rota — só dá para AVISAR):
 *   GET /characters/{id}/planets/            → PiColonySummary[]
 *   GET /characters/{id}/planets/{planet_id}/ → PiColonyLayout
 *   GET /universe/schematics/{id}/            → receita (vem do SDE local aqui)
 *
 * ⚠️ O dado só é recalculado quando o jogador abre a colônia no cliente. Entre
 * aberturas o snapshot fica congelado — `last_update` é a âncora temporal T₀ de
 * toda a projeção. É por isso que o motor existe.
 *
 * Cópia canônica do v2 (o v1 tem a sua em `src/lib/pi/types.ts`): são ~60 linhas
 * de schema da ESI, e duplicá-las é o preço de o v2 não depender do módulo que
 * vai ser apagado. Estruturalmente idênticas — um layout do v1 tipa no v2.
 */

export interface PiExtractorHead {
  head_id: number
  latitude: number
  longitude: number
}

export interface PiExtractorDetails {
  /** Período de cada ciclo do extrator, em segundos. */
  cycle_time?: number
  head_radius?: number
  heads?: PiExtractorHead[]
  product_type_id?: number
  /** Base da curva de decaimento — já é o total das cabeças. */
  qty_per_cycle?: number
}

export interface PiFactoryDetails {
  schematic_id?: number
}

export interface PiPin {
  pin_id: number
  type_id: number
  latitude?: number
  longitude?: number
  schematic_id?: number
  /** Quando o extrator foi ligado — âncora absoluta da curva de decaimento. */
  install_time?: string
  /** Quando o extrator para. Sabemos o fim mesmo com snapshot velho. */
  expiry_time?: string
  last_cycle_start?: string
  extractor_details?: PiExtractorDetails
  factory_details?: PiFactoryDetails
  /** Estoque no instante do snapshot — a condição inicial da projeção. */
  contents?: Array<{ type_id: number; amount: number }>
}

export interface PiRoute {
  route_id: number
  source_pin_id: number
  destination_pin_id: number
  content_type_id: number
  /** Quantidade explícita da rota — não inferir split de 1 storage → N fábricas. */
  quantity: number
  waypoints?: Array<{ order: number; pin_id: number }>
}

export interface PiLink {
  source_pin_id: number
  destination_pin_id: number
  link_level?: number
}

export interface PiColonyLayout {
  pins: PiPin[]
  routes: PiRoute[]
  links: PiLink[]
}

export interface PiColonySummary {
  /** T₀ da projeção: instante do último recálculo feito pelo cliente do jogo. */
  last_update?: string
  num_pins?: number
  owner_id: number
  planet_id: number
  planet_type: string
  solar_system_id: number
  upgrade_level?: number
}
