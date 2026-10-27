'use client'

import type { ReactNode } from 'react'
import { HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

/**
 * O `?` de ajuda — um lugar só para todos eles.
 *
 * Substitui um popover feito à mão que era **posicionado em `absolute` dentro do
 * card**: o texto do Region ficava cortado pela borda do container, e a explicação
 * mais importante da tela era justamente a que não dava para ler.
 *
 * Radix resolve os dois motivos do corte: o conteúdo vai para um **portal** no
 * fim do body (nenhum `overflow` de ancestral o recorta) e tem **detecção de
 * colisão**, virando de lado sozinho quando não cabe. `collisionPadding` garante
 * respiro na borda da janela.
 *
 * Acessibilidade vem de graça no caminho: foco preso enquanto aberto, Esc fecha,
 * `aria-expanded` no trigger.
 */
export function HelpTip({
  title,
  children,
  className,
  label,
}: {
  title: string
  children: ReactNode
  className?: string
  /** Rótulo do botão para leitor de tela. Default: o próprio título. */
  label?: string
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label ?? title}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'inline-flex shrink-0 text-zinc-500 transition-colors hover:text-violet-300',
            className
          )}
        >
          <HelpCircle className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="right"
        sideOffset={6}
        collisionPadding={12}
        className="w-[min(22rem,calc(100vw-2rem))] border-zinc-700 bg-zinc-900 p-3 text-left"
        // O clique dentro da ajuda não pode disparar o colapso do card que a contém.
        onClick={(e) => e.stopPropagation()}
      >
        <p className="mb-1.5 text-xs font-semibold text-zinc-100">{title}</p>
        <div className="space-y-2 text-[11px] font-normal leading-relaxed text-zinc-400">
          {children}
        </div>
      </PopoverContent>
    </Popover>
  )
}

/**
 * Ajuda de UM parágrafo, o formato de 90% dos campos. Existe para o chamador não
 * repetir `<HelpTip><p>{t(...)}</p></HelpTip>` em vinte lugares.
 */
export function FieldHelp({ title, body }: { title: string; body: string }) {
  return (
    <HelpTip title={title}>
      <p>{body}</p>
    </HelpTip>
  )
}
