'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Ícone do item, direto do CDN da CCP.
 *
 * **Jogador de EVE lê por ícone.** Ele reconhece Water, Coolant ou Nano-Factory
 * pela imagem antes de terminar de ler o nome — escanear uma lista de 20 itens
 * com ícone é muito mais rápido do que ler 20 nomes. É o maior ganho de leitura
 * desta passada, e não muda número nenhum.
 *
 * Próprio do pi-v2 (não importa o `PiItemIcon` do v1) para o módulo continuar
 * isolado: quando o v1 for apagado, nada aqui quebra.
 *
 * `<img>` puro de propósito — `next/image` exigiria configuração de loader e
 * traria peso para um ícone de 32px que o CDN já serve cacheado. Falha de
 * carregamento **reserva o espaço** em vez de colapsar a linha: layout que pula
 * quando uma imagem falha é pior que ícone nenhum.
 */

const CDN = 'https://images.evetech.net/types'

export function PiV2ItemIcon({
  typeId,
  name,
  size = 18,
  className,
}: {
  typeId: number
  /** Vira o `alt`; a UI já mostra o nome ao lado, então o alt fica vazio. */
  name?: string
  size?: number
  className?: string
}) {
  const [failed, setFailed] = useState(false)

  if (!typeId || typeId <= 0 || failed) {
    // Placeholder do mesmo tamanho: mantém o alinhamento da coluna.
    return (
      <span
        className={cn('inline-block shrink-0 rounded-sm bg-zinc-800/40', className)}
        style={{ width: size, height: size }}
        aria-hidden
      />
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- ícone de 32px do CDN da CCP; next/image não agrega aqui
    <img
      src={`${CDN}/${typeId}/icon?size=32`}
      alt=""
      title={name}
      width={size}
      height={size}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('inline-block shrink-0 rounded-sm', className)}
      style={{ width: size, height: size }}
    />
  )
}
