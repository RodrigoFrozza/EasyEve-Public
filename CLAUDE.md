# CLAUDE.md — EasyEve_

Companion app de EVE Online para corporação: assinaturas pagas em ISK, atividades (ratting, mining, exploração), killmails, leaderboard e Planetary Industry (PI).

**⚠️ Produção real: ~50 usuários / 105 personagens. Push na `main` → auto-deploy via Coolify. Erros afetam gente de verdade.**

## Regras de Trabalho (obrigatórias)

1. **Regra de ouro — nunca assumir valores.** Todo número vem de SDE, ESI ou order book real — nunca de constante chutada. Se o dado não existe na ESI, rotular explicitamente na UI ("não inclui X") em vez de estimar em silêncio. Dúvida → pesquisar ou perguntar ao Rodrigo.
2. **Otimizar custo sem perder eficiência.** Agentes Haiku/Sonnet em paralelo para exploração e validação; Opus/Fable só orquestra, sintetiza e decide. Chamadas ESI minimizadas por design.
3. **Falha nunca pode ser invisível.** Não engolir erro ESI retornando default. Persistir erros de sync (coluna `error`), degradar por item (um personagem falhou ≠ derrubar todos), nunca agir destrutivamente sobre dados stale. Fallback se anuncia na UI, não zera em silêncio.
4. **Validar a base antes de construir em cima.** Não empilhar features sobre cálculos não validados pelo usuário.
5. **Números otimistas exigem sinalização.** Ou zera, ou avisa — nunca mostrar valor inflado sem aviso.

## Fatos essenciais

- **Zeca Setaum** — personagem Holding/CEO (conta master do Rodrigo); `esiApp='holding'`, `isCorpManager`. É quem tem o token com scope de wallet da corp. Perder essa designação quebra o payment sync silenciosamente (bug de Jul/2026 que ficou 26 dias mudo).
- Stack: Next.js 14 (App Router) + TypeScript, Prisma + PostgreSQL (core + SDE local), Zustand, Tailwind + shadcn/ui. Versões em `docs/TECH_STACK.md`.
- **Auth NÃO usa NextAuth** (dependência morta no package.json): OAuth 2.0 custom (`src/lib/oauth-handlers.ts`) + JWT HS256 de 8h via `jose` (`src/lib/auth-jwt.ts`), stateless. Tokens ESI: AES-256-GCM (`token-cipher.ts`).
- Testes: Jest + React Testing Library (`npm test`) — padrões em `docs/TESTING_GUIDE.md`.
- Dados do jogo: ESI (dinâmico) + SDE local no Postgres (estático). Entrypoints canônicos de sync em `docs/SDE_DOGMA_SYNC_ENTRYPOINTS.md`.

## Onde está o conhecimento

| Fonte | Papel |
|---|---|
| Código no repo + git history | Fonte da verdade final |
| `docs/INDEX.md` → 37 guias | Verdade técnica do código (arquitetura, schema, API, atividades) — inglês |
| `F:\Brain\Geral\07 - EVE Online\EasyEve\` (vault Obsidian Geral; hub: `EasyEve — Hub.md`) | Cérebro: contexto, decisões, histórico de bugs/auditorias — PT, organizado por assunto (`Projeto/`, `Módulos/`, `Histórico/`, `Integrações/`). Conceitos do jogo ficam em `07 - EVE Online\Conhecimento do Jogo\`, compartilhados com a Operação PI. Mudou de lugar em 21/10/2026: o antigo `F:\Brain\Easy-Eve` não é mais a fonte |
| `docs/TROUBLESHOOTING.md` | Problemas conhecidos |
| Brain → `Projeto/EasyEve — Backlog & Decisões Pendentes.md` | Decisões pendentes do Rodrigo — não implementar sem decisão explícita |
| Brain → `Projeto/EasyEve — Prompt de Continuidade (*).md` e `Projeto/Retomada — *.md` | Snapshot de onde a última sessão parou por frente de trabalho |
| `tests/fixtures/golden-fits/` | 7 fits EFT de referência do Rodrigo p/ testes golden do fitting |

**Ao descobrir algo novo ou relevante (bug, decisão, mecânica), atualizar o Brain na pasta do assunto correspondente.**

## Disciplina de sessão (obrigatória)

1. **Início de sessão: `git status` + `git log --oneline -10` ANTES de afirmar qualquer estado.** Sessões paralelas acontecem — o working tree pode conter trabalho em andamento de outra frente. NUNCA descartar/sobrescrever mudanças não commitadas sem perguntar ao Rodrigo.
2. **Agentes nunca commitam/pusham.** Código fica no working tree; revisão, commit e push são do Rodrigo (push = deploy).
3. **Código corrigido ≠ dados corrigidos.** Consertar código de sync não muda nada até o re-sync rodar em produção. Todo fix de sync inclui: correção + teste + passo operacional pós-deploy documentado.
4. **Cleanup de código inclui passada nos docs** (lição dos 5 scripts fantasma de 27/04: docs atualizados 2h antes da limpeza e nunca depois). Docs verificados ganham rodapé `*Last verified against code: YYYY-MM-DD*`.
5. **Snapshots de estado no Brain expiram.** Notas de "onde paramos" devem ser validadas contra o git na retomada, nunca confiadas às cegas.

## Operação em produção (VPS/Coolify)

- **Não existe mais app nem banco de Dev** (out/2026). O banco de produção só é alcançável de dentro do Coolify; o `DATABASE_URL` do `.env` não funciona daqui.
- **Testar antes do deploy = ambiente local sobre cópia de produção**: `scripts/testenv/testenv.ps1` (ver `docs/LOCAL_TESTENV.md`). O restore apaga os tokens ESI da cópia, e o `restore` roda o mesmo `prisma db push` do boot, então mudança de schema se prova aqui primeiro.
- **Consultar produção = MCP de admin** (`/api/mcp`, ver `docs/MCP_SERVER.md`): leitura tipada e escritas com simulação, `confirm` e auditoria.
- **Receita para rodar script no container**: `/app` é read-only e `scratch/` não vai no deploy. Usar: `cat > /tmp/script.js << 'EOF' ... EOF` (JS puro com `require`, não TS/ESM) e `NODE_PATH=/app/node_modules node /tmp/script.js`. Só SELECTs em diagnóstico.
- Entrypoints reais de sync SDE/dogma: `sync-mining-sde`, `sync-module-dogma-esi`, `POST /api/sde/ships/sync`, `POST /api/admin/sync-charges`. Os 5 scripts antigos citados em docs velhos foram removidos em 27/04/2026.

## Armadilhas conhecidas

- Padrão histórico de bug: *engolir erro ESI → valor default → falha invisível*. Não repetir.
- A pasta `brain/` DENTRO do repo é scratch de sessões antigas — o cérebro real é `F:\Brain\Geral\07 - EVE Online\EasyEve\`.
- `docs/INDEX.md` pode estar defasado em relação a auditorias recentes (ver `AUDIT_REPORT_2026-07-05.md` e Brain/Histórico).
- Existem **4 implementações divergentes de preço** (`lib/market.ts`, `getJitaPricesPersistent`, `getRegionalMarketDepth`, `esi.ts::getMarketPrices`) — unificação pendente (Fase 4). Ao mexer em preço, verificar qual fonte a tela usa.
- `fits-v2/engine/modifier-engine.ts` é motor MORTO (nunca chamado) com fórmula de stacking errada — não plugar sem corrigir; destino pendente de decisão.
- ESI market orders tem **rate limit por tokens desde Fev/2026** — features de mercado novas precisam de orçamento de tokens + `ETag`/`expires`.
