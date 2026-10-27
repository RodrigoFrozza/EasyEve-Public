/**
 * Feature flag do módulo PI v2.
 *
 * O v2 é construído EM PARALELO ao `src/lib/pi` antigo. Com a flag OFF (default),
 * nada deste diretório roda em produção e o módulo antigo fica intacto — a
 * remoção do v1 é o último passo do rollout, nunca o primeiro.
 *
 * Rollout: OFF → só o Rodrigo (`PI_V2=<userId>`) → voluntários → geral.
 */

/** Nome da env var que liga o v2. */
export const PI_V2_FLAG_ENV = 'PI_V2'

/**
 * Parser puro de uma feature flag de env com allowlist por usuário. Recebe o
 * valor da env (não lê `process.env`) para ser testável e importável no cliente.
 *
 *  - ausente / '' / '0' / 'false' / 'off' → desligado (default).
 *  - '1' / 'true' / 'on' / 'all'          → ligado para todos.
 *  - qualquer outra coisa                 → allowlist de userIds separada por
 *    vírgula (o rollout "só para o Rodrigo primeiro").
 *
 * É a mesma semântica de `isProjectionEnabledFor` do v1, com o nome genérico que
 * ficou anotado como dívida lá (o parser nunca teve nada de "projection").
 */
export function isEnvFlagEnabledFor(
  flagValue: string | undefined,
  userId: string
): boolean {
  if (!flagValue) return false
  const v = flagValue.trim().toLowerCase()
  if (v === '' || v === '0' || v === 'false' || v === 'off') return false
  if (v === '1' || v === 'true' || v === 'on' || v === 'all') return true
  return flagValue
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(userId)
}

/**
 * Resolve a flag `PI_V2` para um usuário. Server-side: `process.env.PI_V2` não é
 * `NEXT_PUBLIC_`, então no bundle do cliente vem `undefined` → desligado. Quem
 * precisa do valor no cliente deve recebê-lo já resolvido do servidor (mesmo
 * padrão da Fase A, que resolveu uma vez e passou um boolean adiante).
 */
export function isPiV2EnabledFor(userId: string): boolean {
  return isEnvFlagEnabledFor(process.env[PI_V2_FLAG_ENV], userId)
}
