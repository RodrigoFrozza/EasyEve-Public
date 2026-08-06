import { PiV2Portfolio } from '@/components/pi-v2/PiV2Portfolio'

export const metadata = {
  title: 'Planetary Industry v2 | EasyEve',
}

/**
 * Rota separada de propósito. A alternativa era pendurar uma aba dentro da tela
 * atual, o que exigiria editar `PlanetaryIndustry.tsx` — um arquivo do v1, que
 * hoje tem trabalho não-commitado de outra frente. Rota nova mantém o critério
 * de aceite literal: com a flag OFF, o módulo antigo fica intacto byte a byte.
 *
 * O gate real é a API: `/api/pi-v2/portfolio` devolve 404 quando `PI_V2` está
 * desligada para o usuário, e a tela mostra o aviso de indisponível.
 */
export default function PiV2Page() {
  return <PiV2Portfolio />
}
