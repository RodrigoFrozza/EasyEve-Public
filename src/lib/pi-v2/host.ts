/**
 * Costura com a infraestrutura do app — a SEGUNDA e última costura do pi-v2.
 *
 * `sde.ts` isola os dados estáticos do jogo; este arquivo isola a infra: busca na
 * ESI (com o cache que já existe), configuração do usuário, resolução de nomes e
 * log. Nada disso é lógica do módulo PI antigo — é encanamento do EasyEve que o
 * v2 reusa em vez de reinventar.
 *
 * A regra continua valendo: fora de `sde.ts` e deste arquivo, nenhum módulo de
 * `pi-v2/` importa de `@/lib/pi/*`. Quando o v1 for apagado, o que estiver aqui
 * muda de casa; o resto do v2 não percebe.
 *
 * Sobre o custo de ESI: `getCharacterPlanets` e `getColonyLayout` são as MESMAS
 * chamadas cacheadas que o dashboard já faz (lista de planetas 60min; layout
 * chaveado por `last_update`, que só muda quando o jogador abre a colônia). O
 * portfólio do v2 e o alerta do scheduler rodam sobre esse cache — nenhum deles
 * gera chamada nova à ESI.
 */

export { getCharacterPlanets, getColonyLayout } from '@/lib/pi/esi-pi'
export { loadPiUserConfig } from '@/lib/pi/pi-config-store'
export type { PiUserPreferences } from '@/lib/pi/pi-config-store'
export { resolvePlanetNames } from '@/lib/pi/planet-names'
export { resolveSolarSystemNames } from '@/lib/mining-system-names'
export { parseScopesFromJwt } from '@/lib/utils'
export { safeDecryptToken } from '@/lib/crypto/token-cipher'
export { logger } from '@/lib/server-logger'

/**
 * Mercado. `getRegionalMarketDepth` cacheia a profundidade no Postgres e cai no
 * último book conhecido em erro de ESI — não zera preço em silêncio. Estas são
 * as mesmas chamadas que a tela de PI do v1 já faz.
 */
export { fillFromOrders, getJitaPricesPersistent, getRegionalMarketDepth } from '@/lib/market-prices'
export { getStructureMarketDepth } from '@/lib/pi/structure-market'
export { loadReferencePrices } from '@/lib/pi/reference-prices'
export { JITA_REGION_ID } from '@/lib/constants/market'

/** Scope da ESI exigido para ler colônias. Sem ele o personagem é ignorado. */
export const PI_SCOPE = 'esi-planets.manage_planets.v1'

/**
 * Assets — a base do Armazém de PI.
 *
 * Nada disso é novo no app: `esi-assets.read_assets.v1` está na lista de scopes
 * pedida no login desde abril/2026, e estas funções já existem e são usadas pelo
 * Industry (`industry/assets-stock.ts` é o precedente de agregação por typeId).
 *
 * `getCharacterAssets` é chamado com `{ throwOnError: true }` de propósito: o
 * default dele resolve para `[]` em erro, e um armazém "vazio" por falha de ESI
 * viraria desconto indevido na lista de compra — a falha invisível que a regra 3
 * proíbe.
 */
export { getCharacterAssets, getCharacterAssetNames, getStructureNamesBatch } from '@/lib/esi'
export { hasAssetReadScope } from '@/lib/esi-location-discovery'
