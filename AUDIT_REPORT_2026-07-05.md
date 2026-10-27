# Auditoria Completa do Sistema EasyEve — 2026-07-05

Auditoria estática de código (sem execução da aplicação, sem alterações, sem commits) cobrindo todo o sistema já existente. Realizada por 8 agentes paralelos (modelo Fable) especializados por área.

> Nota: o refactor de criptografia de tokens em andamento pelo próprio Rodrigo (`src/lib/crypto/**`, `src/lib/token-manager.ts`, `.env.example`, `.gitignore`) foi excluído da avaliação como bug — é trabalho em progresso do próprio autor. Onde relevante para segurança, isso é mencionado brevemente sem ser tratado como achado.

---

## Sumário executivo

**Total de achados: 137**, distribuídos por severidade:

| Severidade | Quantidade |
|---|---|
| 🔴 Crítico | 7 |
| 🟠 Alto | 23 |
| 🟡 Médio | 63 |
| ⚪ Baixo | 44 |

Por área:

| Área | Crítico | Alto | Médio | Baixo | Total |
|---|---|---|---|---|---|
| 1. Atividades — fluxo ativo | 3 | 3 | 6 | 4 | 16 |
| 2. Atividades — histórico/analytics | 1 | 2 | 9 | 10 | 22 |
| 3. Characters/ESI/OAuth | 0 | 2 | 7 | 4 | 13 |
| 4. Planetary Industry | 1 | 4 | 10 | 5 | 20 |
| 5. Market/Fits | 1 | 3 | 9 | 5 | 18 |
| 6. Subscriptions/Pagamentos | 0 | 2 | 5 | 3 | 10 |
| 7. Painel Administrativo | 1 | 6 | 14 | 10 | 31 |
| 8. Segurança/Infraestrutura geral | 1* | 1 | 3 | 3 | 7 |

\* O crítico da seção 8 (`/api/admin/migrate`) é o mesmo achado da seção 7, confirmado independentemente por dois agentes — contado uma única vez no total geral.

### Top 5 — revisar primeiro

1. **🔴 `/api/admin/migrate` sem NENHUMA autenticação, executando DDL e concedendo role `master`** (`src/app/api/admin/migrate/route.ts`). Qualquer requisição HTTP anônima (`curl`, sem headers Origin/Referer) dispara `ALTER TABLE` e promove a conta "rodrigo frozza" a admin. Confirmado independentemente por dois agentes diferentes. **Ação: remover a rota ou protegê-la com `withAuth({requiredRole:'master'})` imediatamente.**

2. **🟠 Códigos de assinatura vitalícia (PL8R) são transferíveis e ilimitados** (`src/app/api/subscription/activate/route.ts`, `leroy-code/route.ts`). A checagem de membro PulaLeeroy é calculada mas nunca bloqueia o resgate; um único membro pode gerar código → resgatar → gerar outro, indefinidamente, distribuindo premium vitalício de graça para terceiros. **Perda de receita ativa, não hipotética.**

3. **🔴 Renda duplicada entre sessões de ratting** — combinação de três bugs que se reforçam: (a) `container-loot-sync.ts`/`esi.ts:507-511` zera o baseline de loot quando a ESI falha, causando dupla contagem no próximo sync; (b) janela pós-complete do wallet sync de 168 min aplicada a todos os tipos de renda (não só ESS) soma bounties já atribuídos a uma sessão completada; (c) a auto-detecção recria sessões com os mesmos bounties de uma sessão recém-completada. Juntos, corrompem silenciosamente a métrica financeira central do sistema (gross income).

4. **🔴 Snapshot diário de PI é sobrescrito quando a requisição é filtrada por personagem** (`src/app/api/pi/colonies/route.ts:26-31,58-63`). Abrir a aba de PI filtrando por um único personagem grava o snapshot do dia **inteiro do portfólio** com o total parcial — corrompe permanentemente o histórico de performance exibido ao usuário.

5. **🔴 Salvar um fit perde a nave associada** (`useFitEditorV2.ts:674`, `FitsEditorV1.tsx:663`, `src/lib/schemas/index.ts:129-140`, `src/app/api/fits/route.ts:67`). Nenhum editor (v1 ou v2) envia `shipTypeId` ao salvar nem mapeia de volta ao carregar — o Zod descarta silenciosamente o campo `shipId` enviado. Todo fit salvo e reaberto perde a nave, quebrando cálculo de stats e exibição de imagem. **Funcionalidade central quebrada para todos os usuários.**

Menções honrosas que quase entraram no top 5 por impacto: retração de dados de mining ausente no delete (polui permanentemente o loot-intel da comunidade), squatting de personagem via `POST /api/characters`, e as demais rotas admin sem autenticação (`sync`, `sync-charges`, `repair`, `repair/activate-fits`, `debug/sync-all`, `debug/sync-tags`).

---

## 1. Atividades — Fluxo Ativo (ratting, mining, exploration, salvaging, abyssal, escalations)

### 🔴 Crítico

**1.1 — Loot-sync de contêiner zera o baseline quando a ESI falha → dupla contagem de todo o loot**
- **Arquivo:** `src/lib/esi.ts:507-511` + `src/lib/activities/container-loot-sync.ts:224, 313-346, 154-173`
- **Problema:** `getCharacterAssets()` engole erros e retorna `[]` (só lança com `throwOnError`, que `fetchContainerContents` não passa). Com assets vazios, o baseline de todo tipo ausente é resetado via `mergeLootSnapshotPeak`.
- **Cenário de falha:** rate-limit/5xx da ESI durante um sync → leitura vazia → baseline apagado → no próximo sync bem-sucedido, todo o conteúdo ainda no MTU/contêiner é tratado como loot novo → `estimatedLootValue`/`totalLootValue` duplicado silenciosamente (afeta ratting, exploration e salvaging com auto-loot).
- **Sugestão:** chamar `getCharacterAssets(id, { throwOnError: true })` em `fetchContainerContents` e abortar o sync em erro; nunca persistir snapshot derivado de leitura vazia.

**1.2 — Janela pós-complete do wallet sync (168 min) + lookback (−30 min) → renda duplicada entre sessões**
- **Arquivo:** `src/lib/activities/ratting-wallet-sync.ts:156-160`, `src/lib/constants/ratting.ts:2`, `src/lib/stores/activity-store.ts:263, 438-444`
- **Problema:** sessão completada aceita entradas até `endTime + 168min`; sessão ativa aceita desde `startTime − 30min`. Sem min-gap, o cliente sincroniza sessões completadas a cada 4 min por quase 3 horas.
- **Cenário de falha:** usuário encerra sessão A às 20:00 e continua caçando; bounties de 20:00–22:48 são somados a A (janela 168min) **e** a auto-detecção cria a sessão B com os mesmos bounties (janela 30min) → renda duplicada em A e B.
- **Sugestão:** pós-complete, aceitar só `date <= endTime` (+tolerância mínima) exceto para `ess_payout`; no lookback de sessões novas, descartar entradas anteriores ao `endTime` da última sessão do personagem.

**1.3 — Auto-detecção recria sessão com bounties de sessão recém-completada**
- **Arquivo:** `src/lib/activities/auto-activity-detection.ts:318-373` + `src/lib/activities/activity-participant-queries.ts:9-20`
- **Problema:** `detectRattingActivity` usa janela rolante de 30 min sem guarda de "sessão completada recentemente" (só verifica `status: 'active'`).
- **Cenário de falha:** usuário completa sessão manualmente às 15:00 e para de jogar; ciclo de detecção às 15:03 vê os bounties de 14:33–15:00 e cria nova sessão fantasma com renda duplicada no histórico.
- **Sugestão:** na detecção, ignorar entradas de journal com `refId` já registrado ou `date <= endTime` da última sessão completada do personagem.

### 🟠 Alto

**1.4 — Exploration sync grava sem lock otimista → perde logs adicionados concorrentemente**
- **Arquivo:** `src/lib/activities/exploration-sync.ts:132-146`
- **Cenário:** sync em background lê `activity.data`, faz chamadas ESI seriais, e regrava tudo incondicionalmente; se o usuário registrar um site nesse meio-tempo (que usa lock corretamente), o sync sobrescreve e o log/`totalLootValue` somem.
- **Sugestão:** aplicar o mesmo lock otimista por `updatedAt` usado em wallet/mining/abyssal/loot sync.

**1.5 — Mining: crescimento de quantidade não conta como progresso → auto-pause de sessão ativa e ISK/h inflado**
- **Arquivo:** `src/lib/activities/mining-activity-sync.ts:313-330, 557`
- **Cenário:** minerar o mesmo minério no mesmo sistema por >60min não gera `logKey` novo → `lastDataAt` nunca avança → auditoria de stale pausa retroativamente a sessão ativa; ao retomar, o intervalo é contado como pausa, subestimando duração e inflando m³/h e ISK/h.
- **Sugestão:** marcar `lastDataAt` quando a quantidade agregada aumentar, não só em key novo.

**1.6 — Fórmulas de ISK/h e gross/net reinventadas com divergências entre módulos**
- **Arquivos:** `ratting-wallet-sync.ts:314-320` (sem taxes/expenses/escalations, piso 0.1h), `session-kpis.ts:135,178,252,266,313` (net com piso 0.01h), `use-activity-metrics.ts:106-110` (sem piso), `use-activity-stats.ts:37` (piso 0.01h), `abyssal-metrics.ts:59-74`.
- **Cenário:** sessão com 100M gross, 20M taxes, 30M expenses: card mostra ISK/h ~50M (net) enquanto `iskTrend` sobe/desce com base em ~100M/h (gross) — badge "up" com valor exibido caindo. Pisos diferentes produzem valores até 10× diferentes nos primeiros minutos.
- **Sugestão:** extrair função única `iskPerHour(net|gross, durationMs)` com piso único, consumida por sync, KPIs e hooks.

### 🟡 Médio

**1.7 — Abyssal: `gross` soma lootValue de TODOS os runs; KPIs contam só completados** — `activity-metrics.ts:50-53` vs `abyssal-metrics.ts:48-57`. Run com status `death` e loot perdido conta 0 no KPI mas soma no gross exibido/política de descarte — painéis divergem.

**1.8 — Merges de logs descartam logs do servidor sem `refId`** — `ratting-logs-merge.ts:15-19`, `exploration-logs-merge.ts:22-26`, `salvaging-logs-merge.ts:21-25`. Logs legados sem `refId` somem em qualquer PATCH se o cliente não os tiver no payload.

**1.9 — Dedup semântica de ratting pode engolir eventos legítimos distintos** — `ratting-log-dedup.ts:51-59,61-74,121-134`. Dois payouts reais com mesmo valor arredondado e `refId`s diferentes podem ser tratados como duplicata.

**1.10 — Pause/resume: read-modify-write sem versionamento entre 3 atores** — `ActivityCard.tsx:52-96`, `auto-activity-detection.ts:453-490`, `api/activities/[id]/route.ts:297-309`. Cliente com estado stale pode sobrescrever pausa calculada pelo servidor, contando inatividade como tempo ativo.

**1.11 — Escalations pausada não bloqueia auto-create de ratting → renda duplicada entre tipos** — `auto-activity-detection.ts:420-429`. Ao contrário de ratting pausada, escalations pausada permite que a detecção crie sessão ratting com os mesmos bounties que depois entram também na escalations retomada.

**1.12 — Perfil público "totalActivityHours" soma o tempo PAUSADO** — `api/players/[userId]/route.ts:80-88,145`. Agrega `accumulatedPausedTime` como se fosse horas de atividade — quem nunca pausa mostra 0h.

### ⚪ Baixo

**1.13** Leitura do valor do log diverge entre módulos (`amount` vs `value` vs `Math.max` de ambos) — `ratting-manual-entries.ts:290-303`, `exploration-data-recalc.ts:5-7`, `salvaging-data-recalc.ts:9-11`, `activity-metrics.ts:44-48`.

**1.14** Consolidação de duplicatas concatena logs sem dedup — `auto-activity-detection.ts:154-158` — soma journal entries em dobro até o próximo wallet sync corrigir.

**1.15** Exclusão de log legado por chave composta apaga múltiplos registros — `ExplorationActivityContent.tsx:49-58,104-139` — sites idênticos no mesmo segundo são apagados juntos.

**1.16** Sessões completadas re-sincronizadas a cada 4min por 168min por aba aberta (~42 syncs ESI por sessão) — `activity-store.ts:438-444` — agrava o risco do achado 1.1.

**Pontos positivos confirmados:** wallet sync ratting, mining sync, abyssal sync e loot sync usam lock otimista corretamente; add-site/add-loot retornam 409 em conflito; erros por participante são isolados e exibidos na UI; `getActivityDurationMs` é fonte única de duração.

---

## 2. Atividades — Histórico e Analytics

### 🔴 Crítico

**2.1 — Mining não tem retração no DELETE — dados de sessões deletadas ficam para sempre no loot-intel da comunidade**
- **Arquivo:** `src/app/api/activities/[id]/route.ts:442-472` + `src/lib/analytics/mining-loot-intel-ingest.ts:296`
- **Problema:** o handler DELETE chama retração para abyssal, salvaging, ratting e exploration, mas **não** para mining. `retractMiningLootInTx` existe mas não é exportado nem chamado.
- **Cenário:** usuário deleta sessão de mining já ingerida — os rollups da comunidade (`MiningLootDimensionRollup`/`RegionRollup`/`ItemRollup`) continuam contando eventos, ISK e duração para sempre; o backfill não repara (filtra `isDeleted:false`).
- **Sugestão:** exportar `retractMiningLootForActivity(activityId)` e chamá-lo no DELETE, no mesmo padrão dos outros tipos.

### 🟠 Alto

**2.2 — Nenhuma proteção contra outliers em nenhum ingest de loot-intel** — `exploration-loot-intel-ingest.ts:77-99`, `abyssal-loot-intel-ingest.ts:265-266`, `ratting-loot-intel-ingest.ts:40-55,296-303`, `mining-loot-intel-ingest.ts:232-233`. Valores vêm de `activity.data` (controlado pelo cliente via PATCH) sem teto/winsorização. Um único log com valor absurdo (bug de cliente ou malícia) corrompe permanentemente a média global da comunidade.

**2.3 — Timeline do histórico soma despesas como receita (sem sinal), divergindo do gráfico ao vivo** — `EarningsTimelineSection.tsx:59` usa `getLogValue` sem sinal para todos os tipos de log, enquanto o live usa `getRattingLogSignedValue` que nega expenses e zera taxes/escalations dropped. Mesma sessão, dois totais diferentes (ex.: 100M no live vs 135M no histórico com 20M de expenses + 15M de escalation dropped).

### 🟡 Médio

**2.4** Retração de ratting recomputa `sessionGross`/`spaceType` a partir dos dados ATUAIS, não dos valores da época da ingestão — `ratting-loot-intel-ingest.ts:208-226`. Edição posterior via PATCH causa resíduo permanente no rollup da facção.

**2.5** Retração de exploration recomputa a duração em vez de usar snapshot — `exploration-loot-intel-ingest.ts:225-228` (mining e ratting já snapshotam; exploration não).

**2.6** Decrementos read-modify-write não atômicos em todos os `dec*` de loot-intel → lost updates em retrações concorrentes — `exploration/abyssal/ratting/mining-loot-intel-ingest.ts` (múltiplas linhas). Duas retrações simultâneas na mesma linha de rollup podem perder um dos decrementos.

**2.7** Abyssal: três fórmulas divergentes de gross/contagem de runs entre `activity-metrics.ts:50-53`, `session-kpis.ts:352-365`+`abyssal-metrics.ts:44-57`, e `activity-analytics.ts:676` (ignora status `success`, só aceita `completed`).

**2.8** Header "Gross" da composição (visão "all") vem de `data.*` enquanto as fatias vêm de logs — podem não fechar quando há `additionalBounties` manual sem log correspondente — `RattingAnalyticsPanel.tsx:111-116`.

**2.9** Métrica "Bounty"/"Loot" do bloco de intel colapsa para 0 por NaN quando um campo está ausente — `RattingAnalyticsPanel.tsx:134-136,140-142` (`Number(undefined) + Number(x) = NaN`).

**2.10** Chave do filtro por personagem invertida/incompleta entre painéis — `RattingAnalyticsPanel.tsx:50`, `ExplorationAnalyticsPanel.tsx:44`, `EscalationsAnalyticsPanel.tsx:40` usam ordem diferente de `MiningAnalyticsPanel.tsx:124`; log sem nenhum id ou com `charId`/`characterId` divergentes pode zerar o filtro.

**2.11** Mining: filtro por personagem afeta o gráfico mas não a composição nem a valuation (fix do commit 975cb30 não cobriu mining) — `MiningAnalyticsPanel.tsx:177-183`.

**2.12** Escalations: composição ignora `tax` nas deduções, mas o chart e `metrics.net` a descontam — `activity-analytics.ts:413-449` vs `:472-486`.

### ⚪ Baixo

**2.13** Retração/ingestão fire-and-forget sem retry nem trilha de reparo — `route.ts:443-472`, `loot-intel-dispatch.ts:50-54`.

**2.14** Itens duplicados no mesmo evento têm quantidade/valor descartados no rollup de itens (dedupe correto para contagem, mas subnotifica quantidade/valor) — `exploration/ratting/abyssal-loot-intel-ingest.ts`.

**2.15** Query de "top drops" de abyssal sem filtro por dimensão, rotulado como global — `abyssal-loot-intel-query.ts:154-159`.

**2.16** Gross do bloco de intel do histórico (ratting) omite escalations enquanto o dialog inclui — `SessionLootIntelSection.tsx:105-110` vs `activity-metrics.ts:74`.

**2.17** `MiningSummaryPanel.tsx` é componente morto (não importado por ninguém) com violação de rules-of-hooks (early-return antes de `useMemo`, linha 119/127) e fórmula ISK/h própria divergente.

**2.18** KPI row descarta silenciosamente extras calculados para tipos não-ratting (mining perde yield/h, exploration/salvaging perdem lootValue, abyssal perde bestRun) por um `slice(0,4)` fixo — `ActivityAnalyticsDialog.tsx:97-98`.

**2.19** Composição de mining soma Gross apenas do top-8 de ores — `activity-analytics.ts:344`.

**2.20-2.22** Hooks: `useActivityMetrics` re-renderiza/recalcula por segundo mesmo em histórico completado; `useMiningSessionValuation` congela ISK/h de sessão ativa até o objeto `activity` mudar; `useExplorationLootIntel` sem guarda de resposta stale (sem AbortController, ao contrário do par de abyssal).

---

## 3. Characters / ESI / OAuth

### 🟠 Alto

**3.1 — `POST /api/characters` confia em `characterId`+`accessToken` do cliente sem verificar vínculo**
- **Arquivo:** `src/app/api/characters/route.ts:99-152` (vs. fluxo confiável em `oauth-handlers.ts:219-221`)
- **Cenário:** qualquer usuário autenticado pode enviar um `characterId` que não controla; falhas 403 de endpoints autenticados da ESI são engolidas como 0/{}, e o registro é criado como propriedade do atacante — squatting de personagem.
- **Sugestão:** derivar `characterId`/`ownerHash` de `getCharacterInfo(accessToken)` no servidor, ignorando os valores do body.

**3.2 — Killmails sem autenticação e sem checagem de `isPublic`**
- **Arquivo:** `src/app/api/players/[userId]/killmails/route.ts:13-51`
- **Cenário:** `getSession` é importado mas nunca chamado — a rota é pública mesmo para perfis com `isPublic=false`; além disso usa o token do alvo para até 100 chamadas ESI por request sem cache, permitindo amplificação/DoS do error-budget do personagem-alvo.
- **Sugestão:** exigir sessão (ou aplicar `isPublic`), cachear/limitar as chamadas de detalhe.

### 🟡 Médio

**3.3** Sub-rotas de players (`fits`, `medals`, `killmails`) checam só seu flag específico, não o `isPublic` mestre — perfil privado com flags default `true` ainda expõe dados.

**3.4** `getValidAccessToken` não persiste estado inválido quando o refresh falha — `token-manager.ts:104-108`. Personagem com refresh token revogado gera retries repetidos até a task horária marcar inválido.

**3.5** Perda do refresh token rotacionado em falha de escrita/corrida entre processos — `token-manager.ts:113-127`. Se `prisma.character.update` falhar após refresh bem-sucedido, o personagem fica "brickado" (token novo perdido, antigo já invalidado pela EVE).

**3.6** `handleLinkFlow` apaga a conta inteira do usuário "órfão" ao migrar personagem — `oauth-handlers.ts:230-247`. Usuário legítimo com 1 personagem pode ter conta inteira (assinatura, pagamentos, atividades) apagada silenciosamente.

**3.7** Sem retry/backoff no ESI client apesar do comentário prometer — `src/lib/esi-client.ts:59-99`.

**3.8** Rate-limit/concorrência do ESI é estado global em memória, ineficaz em deploy multi-instância — `esi-client.ts:10-26,86-89`.

**3.9** Falhas de scope ausente são silenciadas como dados vazios/zero em vez de sinalizar reautorização — `esi.ts` (wallet, skills, assets, mining ledger, fits, contracts, notifications, industry jobs).

### ⚪ Baixo

**3.10** Remoção de personagem deixa Activities/PI órfãos (sem FK) e não invalida caches em memória chaveados por characterId.

**3.11** `parseScopesFromJwt` decodifica com `base64` em vez de `base64url` — `utils.ts:142-160`.

**3.12** `getCharacterInfo` decodifica JWT sem verificar assinatura contra o JWKS da EVE — `esi.ts:98-138`.

**3.13** Rota de e-mail entre jogadores sem rate-limit nem checagem de bloqueio/consentimento — `players/[userId]/email/route.ts:19-69` (autorização em si está correta).

---

## 4. Planetary Industry (PI)

### 🔴 Crítico

**4.1 — Requisição filtrada por personagem sobrescreve o snapshot diário do portfólio inteiro**
- **Arquivo:** `src/app/api/pi/colonies/route.ts:26-31,58-63` + `portfolio-performance.ts:68-97`
- **Cenário:** usuário com 3 personagens (120M ISK/h total) abre a aba de PI de 1 personagem (40M ISK/h) → `recordPiDailySnapshot` sobrescreve a entrada do dia com o total parcial → gráfico de performance histórica mostra queda de 66% que nunca existiu.
- **Sugestão:** só gravar snapshot quando não houver filtro de personagem ativo.

### 🟠 Alto

**4.2** Estado `stalled` é inalcançável no caminho por-pin da simulação de buffer — `buffer-sim.ts:154-157,72,288-290`. Buffer vazio com consumo líquido negativo nunca aciona `timeToEmptyHrs<=0`, então a colônia nunca é reportada como parada mesmo quando as fábricas já cessaram.

**4.3** Surplus só é valorado dentro de uma rede, nunca sozinho — `demand-model.ts:505-527` (parâmetro `surplusForSale` morto, sempre retorna 0) vs `network-model.ts:36-46,341-371`. O mesmo planeta muda de valor só por pertencer a uma rede sem edges; o toggle `surplusForSale` não faz nada.

**4.4** Preço ausente vira 0 silenciosamente ao nível de rede, sem warning (colônia individual avisa, rede não) — `pi-pricing.ts:34-35,55-56` + `network-model.ts:400-416`. Distorce `netIskPerHour` (para baixo em exports, para cima em imports com custo zero).

**4.5** Falha parcial de ESI (1 de N personagens) é assimilada como "produção caiu" e cacheada/persistida no snapshot diário sem sinalizar a falha — `isk-per-hour.ts:66-74,95-103`.

### 🟡 Médio

**4.6** `averageUnitsPerHour` zera a taxa "current" durante todo o primeiro ciclo do extrator — `extractor-decay.ts:105-113`.

**4.7** Modo "current" da simulação de buffer usa capacidade de rota projetada, não produção real — extrator expirado ainda "enche" o buffer nos cálculos — `buffer-sim.ts:128-151` + `demand-model.ts:83-148`.

**4.8** Overflow de buffer nunca desconta produção da valoração financeira — `demand-model.ts:407-412` só trata produto final não roteado, ISK continua contado com buffer cheio.

**4.9** `network-compat` valida sempre em modo `potential`; auto-link opera no `rateMode` escolhido — inconsistência entre "compatível" mostrado e link real feito — `network-compat.ts:12-38` vs `auto-link-network.ts:161`.

**4.10** `unitsPerHour` salvo nos edges de rede é snapshot congelado — aumento de produção depois do auto-link não gera receita extra — `network-model.ts:168,226-239`.

**4.11** Lógica de alocação supply/demand duplicada e já divergente em 4 lugares (`network-model.ts`, `network-editor.ts`, `auto-link-network.ts`) — mesmo edge pode ser "ok" no editor e "flow 0" na análise financeira.

**4.12** Order book vazio persiste `buy:0/sell:0` por 45min como preço válido — `market-prices.ts:118-139`.

**4.13** Atribuição de ISK por personagem dilui quando `memberPlanetIds` inclui planetas sem colônia ativa (demolida) — soma por personagem não bate com total do portfólio — `portfolio-attribution.ts:58-66`.

**4.14** `refreshCommodityTiers` quebra com payload legado sem `potential`/`current` em `balances` — TypeError derruba a normalização inteira — `normalize-response.ts:41-46,97`.

**4.15** Casts sem validação de schema em `esi-pi.ts` — mudança de schema da ESI faz colônia desaparecer silenciosamente do dashboard (e pode ser cacheada como `null` por 30min).

### ⚪ Baixo

**4.16** Hack de "inteiro exato −1" no output de ciclo do extrator (`extractor-decay.ts:15`) parece bug não documentado.

**4.17** Loop de ciclos sem teto — payload ESI corrompido (cycle_time=1, programa de anos) custa CPU por request.

**4.18** `limitingPinId`/`limitingTypeId` inconsistentes no agregado de buffer (par pin/commodity pode não corresponder).

**4.19** Ciclos multi-commodity não detectados no chain-graph (tolerado, sem crash, mas layout instável).

**4.20** `DEFAULT_ROUTING` é objeto mutável compartilhado entre colônias legadas (`normalize-response.ts:20,98`) — armadilha de aliasing.

---

## 5. Market / Fits

### 🔴 Crítico

**5.1 — Round-trip `shipId` ↔ `shipTypeId` quebrado: todo fit salvo perde a nave**
- **Arquivos:** `useFitEditorV2.ts:674`, `FitsEditorV1.tsx:663` (save envia `shipId`), `src/lib/schemas/index.ts:129-140` (schema só conhece `shipTypeId`, Zod descarta `shipId`), `api/fits/route.ts:67` (grava `NULL`), load sem mapeamento reverso.
- **Cenário:** usuário cria fit, seleciona hull, salva → `shipTypeId=NULL` no banco. Ao reabrir, stats zeradas, "Select a ship first", sem imagem da nave. Afeta v1 e v2 igualmente.
- **Sugestão:** mapear `shipId ↔ shipTypeId` tanto no load quanto no save.

### 🟠 Alto

**5.2** Salvar fit não passa por validação de fitting (CPU/PG/slots) — só valida a forma via Zod, nunca chama `validateFittingState` — `api/fits/route.ts:41-79`, `api/fits/[id]/route.ts:42-84`. Fits fisicamente impossíveis (CPU 400% do limite) são aceitos e ficam públicos.

**5.3** `ShipAttributesPanel` faz POST num endpoint que só aceita GET (405 sempre) e, mesmo corrigido, calcularia preço fabricado (1M ISK fixo por módulo) — `ShipAttributesPanel.tsx:74-88` vs `api/market/prices/route.ts:11`.

**5.4** Fallback de preço global baixa a lista completa de ~14k itens do ESI por item sem liquidez, dentro de loop concorrente de 15 threads — `market.ts:121-128`. Modal com 40 itens pouco líquidos dispara até 40 downloads simultâneos, consumindo o error-budget do ESI global do app.

### 🟡 Médio

**5.5** Appraisal por nome (`market.ts`) não tem fallback stale — falha do ESI vira preço 0 silencioso (diferente de `market-prices.ts`, que tem fallback).

**5.6** Itens não resolvidos pelo `/universe/ids` (ex.: nomes localizados) viram preço 0 sem indicação — `api/market/parse/route.ts:29`, `api/market/appraisal/route.ts:19-22`.

**5.7** `getMarketPrices` cacheia resultado de falha (`{}`) como dado válido por 5min — `esi.ts:416-419` + `cache.ts:29-41`.

**5.8** MarketClient mantém ordens do item anterior na tela quando o fetch do novo item falha (sem limpar estado nem mostrar erro) — `MarketClient.tsx:90-95,100-102`.

**5.9** `page` não é resetado ao trocar de item selecionado — navegar para página 5 de um item e trocar para outro com 1 página resulta em tabela vazia — `MarketClient.tsx:65-78`.

**5.10** Árvore de mercado truncada por corte arbitrário `id < 3000` — grupos novos (filamentos, SKINs) nunca aparecem — `api/market/groups/route.ts:40`.

**5.11** `/api/market/appraisal` sem autenticação, sem gating de módulo, sem limite de itens — fan-out de centenas de chamadas ESI por request anônimo.

**5.12** Fit sem assinatura premium ativa recebe `{}` com HTTP 200 ao carregar — editor abre em estado corrompido sem aviso de paywall — `api/fits/[id]/route.ts:34-36`.

**5.13** Schemas Zod de fit permissivos: `id`/`typeId` ambos opcionais, `quantity` negativa/fracionária aceita, `esiData: z.any()` sem limite de tamanho.

### ⚪ Baixo

**5.14** Parser de cargo divide nome de item terminado em número (ex: "Item 3") em nome+quantidade — comportamento intencional para multibuy mas corrompe nomes legítimos fora desse contexto.

**5.15** Parser assume que a 2ª coluna de formato tab-separado é sempre quantidade, sem sanity-check contra colunas reordenadas pelo jogador.

**5.16** Código morto/órfão: `api/market/parse`, `api/fits/v2/compare|capacitor|explain|recommend|presets` (página compare foi removida), script solto `api/market/appraisal/check-db.ts` com `process.exit(0)` em escopo de módulo.

**5.17** PUT de fit não permite limpar campos (`null` tratado como "não atualizar").

**5.18** Cache de appraisal rotulado "LRU" é na verdade FIFO (sem refresh no acesso).

---

## 6. Subscriptions / Pagamentos

### 🟠 Alto

**6.1 — Códigos PL8R (lifetime) são "bearer tokens" transferíveis, sem vínculo com destinatário**
- **Arquivo:** `api/subscription/activate/route.ts:46-75` + `leroy-code/route.ts:16-75`
- **Cenário:** membro PulaLeeroy gera código, passa/vende para terceiro não-membro → terceiro resgata e recebe premium vitalício de graça. A checagem de membro é calculada mas nunca bloqueia o resgate.
- **Sugestão:** vincular código a `usedById`/destinatário; exigir que resgatador seja membro no momento do resgate.

**6.2 — Um membro pode cunhar códigos vitalícios ilimitados (faucet de premium)**
- **Arquivo:** `leroy-code/route.ts:34-74`
- **Cenário:** guard só impede ter mais de um código *não-usado* simultâneo; assim que resgatado, nova chamada gera outro. Sem cap total nem rate-limit — fonte infinita de premium vitalício. Amplifica o achado 6.1.

### 🟡 Médio

**6.3** Resgate de código sem guarda condicional no UPDATE (`isUsed` checado só na leitura, não no `where` do write) — hoje mitigado por leitura de saldo obsoleta, mas frágil a mudanças futuras — `activate/route.ts:29-39,52-67,83-98`.

**6.4** `subscriptionEnd` calculado a partir de leitura obsoleta — dois códigos DAYS resgatados quase simultaneamente fazem o usuário perder dias pagos — `activate/route.ts:77-80`.

**6.5** Crédito de ISK do wallet-sync não é atômico (Payment.create → user.update → iskHistory.create soltos) — falha entre os passos perde o crédito permanentemente mesmo com o pagamento já registrado — `admin/payments/sync/route.ts:128-154`, `tasks.ts:123-152`.

**6.6** Membership PulaLeeroy é gravada num GET e nunca revalidada — membro que sai da corp continua elegível a gerar códigos vitalícios para sempre — `check-pula/route.ts:59-72`.

**6.7** Rate-limit fraco contra brute-force de códigos PL8R (4 caracteres, ~1 milhão de combinações, sem throttle dedicado) — `activate/route.ts`, `activation-codes.ts:20,69-71`.

### ⚪ Baixo

**6.8** Doações com memo não identificado creditam automaticamente o usuário master, em vez de ficar pendente para revisão manual.

**6.9** `syncCorporationPayments` em `tasks.ts` é duplicata de `admin/payments/sync/route.ts`, não referenciada pelo scheduler — risco de as duas cópias divergirem (já divergem: fallback de manager diferente, tratamento de erro diferente).

**6.10** Loop de geração de código pode sair silenciosamente sem código único garantido após 10 tentativas, resultando em erro 500 na constraint única.

**Pontos positivos confirmados:** `subscribe/route.ts` usa `SELECT...FOR UPDATE` corretamente dentro de transação (padrão de referência); replay de transação ISK protegido por `journalId @unique`; autorização de todas as rotas usa `session.user.id`, sem parâmetro manipulável.

---

## 7. Painel Administrativo

### 🔴 Crítico

**7.1 — `/api/admin/migrate` sem NENHUMA autenticação, executando DDL e escalação de privilégio**
- **Arquivo:** `src/app/api/admin/migrate/route.ts:4-36`
- **Cenário:** `GET` público roda `ALTER TABLE` via `$executeRawUnsafe` e promove a `master` o dono do personagem "rodrigo frozza" hardcoded. Qualquer requisição anônima sem headers Origin/Referer (que o middleware não força para autenticação) executa isso.
- **Sugestão:** remover a rota (migração one-shot já aplicada) ou envolver com `withAuth({requiredRole:'master'})` e remover o nome hardcoded.

### 🟠 Alto

**7.2** `/api/admin/sync` (POST/GET/DELETE) sem autenticação — dispara jobs pesados de sync SDE/ESI repetidamente (DoS) ou limpa status de job legítimo em andamento.

**7.3** `/api/admin/sync-charges` idêntico ao anterior, sem autenticação.

**7.4** `/api/admin/repair` (POST) sem autenticação aceita `dryRun:false` e reescreve `shipStats` em produção.

**7.5** `/api/admin/repair/activate-fits` (GET) sem autenticação ativa o módulo "fits" com preço 0 para toda a plataforma.

**7.6** DELETE de conta de usuário: hard delete sem audit log, sem guard de auto-deleção — admin (única conta master) pode se auto-deletar por engano, com recuperação dependendo da rota sem-auth do achado 7.1.

**7.7** Reject/link de pagamento não estorna nem migra `iskBalance` já creditado — usuário rejeitado ou re-vinculado mantém/perde saldo de forma inconsistente com o que o admin vê.

### 🟡 Médio

**7.8** `CRON_SECRET` transmitido em query string (`?token=`) — vaza em logs de acesso/proxy.

**7.9** Scheduler sem guard de execução sobreposta por schedule (só a rota manual tem) — script que demora mais que sua cadência roda em múltiplas instâncias paralelas sobre os mesmos dados.

**7.10** Lock de tick do scheduler é variável de módulo (por processo), claim de schedule não atômico — cron externo + heartbeat interno ou múltiplas instâncias podem duplicar execução do `sync-wallet-journal` (financeiro).

**7.11** Runner sem timeout/watchdog — processo morto no meio de um script deixa execução `running` eterna, bloqueando execução manual por até 7 dias (até o cleanup).

**7.12** Health check mede liveness do tick do scheduler, não sucesso dos scripts — script crítico pode falhar 100% por uma semana e o health continua "healthy".

**7.13** Block/unblock de conta sem validação de body, sem audit log, sem guard de auto-bloqueio, sem confirmação na UI.

**7.14** Auditoria (securityEvent) inconsistente entre ações admin — payments/feature-flags gravam, mas accounts PUT, subscription grant, accounts/credit não.

**7.15** Crédito de pagamento não roda em transação (`create` → `increment` → `history` soltos) — mesma classe de bug do achado 6.5, duplicada aqui.

**7.16** Sync de pagamento sob concorrência (manual + scheduled simultâneos) aborta o lote inteiro no primeiro conflito de `journalId` único, em vez de pular e continuar.

**7.17** Lógica de sync de pagamentos duplicada e já divergente entre `payments/sync/route.ts` e `tasks.ts` (fallback de manager diferente, tratamento de erro diferente).

**7.18** Doações não identificadas (sem match de accountCode/personagem) creditam automaticamente o usuário master.

**7.19** `actionConfig` de promo banners é `z.record(z.any())` e `externalUrl` vai direto para `window.open` — XSS armazenado possível via `javascript:` URL se uma sessão admin for comprometida.

**7.20** Operações de manutenção (repair, sync, migrate, recalculate-mining, backfill) sem trilha persistente de auditoria — status vive em arquivo temp que evapora em restart.

**7.21** `recalculate-mining` com `forceAll=true` divide cegamente por 100 toda sessão não-ice, corrompendo dados legítimos na primeira passada (idempotente só na segunda execução).

### ⚪ Baixo

**7.22** Rota `debug/module/[typeId]` com checagem de role quebrada (`'ADMIN'` em vez de `'master'`) — fail-closed, rota morta.

**7.23** `runner.ts` nunca preenche a coluna `error` de execuções falhas — admin vê "failed" sem motivo.

**7.24** Falha em escrita de log intermediária marca execução bem-sucedida como `failed`.

**7.25** Cron inválido salvo pelo admin degrada silenciosamente para +24h em vez de rejeitar com erro.

**7.26** `filter=active` em busca de contas sobrescreve o `OR` da busca por texto — admin pode agir sobre conta errada.

**7.27** `count` sem teto na criação de códigos promocionais — `POST {count: 1000000}` esgota conexões de DB.

**7.28** Homepage carousel: `imageUrl`/`link` sem validação de protocolo (`javascript:` possível no link).

**7.29** Upload de imagem do carousel validado por `Content-Type` controlado pelo cliente, não por magic bytes; grava debug log na raiz do projeto.

**7.30** 4 de 5 feature flags no admin não têm nenhum consumidor no código — admin acredita controlar comportamento que não existe.

**7.31** Desativar `autoLootTracking` não afeta atividades já em andamento (valor congelado no momento do launch) — efeito parcial não documentado na UI.

**Pontos positivos confirmados:** a grande maioria das rotas admin usa corretamente `withAuth({requiredRole:'master'})`; `payments/[id]/approve` é o melhor endpoint do módulo (transação, verificação de estado anterior, audit log); `backfill-mining-geo` tem dry-run default e é idempotente; `required-schedules.ts` recria schedules obrigatórios de forma idempotente.

---

## 8. Segurança e Infraestrutura Geral

(Achados adicionais não cobertos nas seções anteriores; o crítico do `/api/admin/migrate` já consta na seção 7 e não é reduplicado no total.)

### 🟠 Alto

**8.1 — `/api/debug/sync-all` e `/api/debug/sync-tags` sem autenticação (DoS + poluição de dados)**
- **Arquivo:** `src/app/api/debug/sync-all/route.ts:19-78`, `src/app/api/debug/sync-tags/route.ts:16-69`
- **Cenário:** `GET` público dispara fetch em massa na ESI e upsert de milhares de linhas por chamada — amplificação de escrita e tráfego sem custo para o atacante.

### 🟡 Médio

**8.2** `/api/debug/db-check` sem autenticação expõe conteúdo de tabelas de SDE (baixa sensibilidade, mas endpoint de diagnóstico público).

**8.3** Bypass de flags de privacidade `showWallet`/`showLocation` em `/api/players/[userId]/characters` — a rota principal do perfil respeita esses flags, esta não; usuário que esconde saldo/localização ainda os expõe via esta rota.

**8.4** Ausência de headers de segurança no `next.config.js` — sem CSP, `X-Frame-Options`/`frame-ancestors` (clickjacking), HSTS, `X-Content-Type-Options`. Agravado por `typescript.ignoreBuildErrors:true` e `eslint.ignoreDuringBuilds:true`.

### ⚪ Baixo

**8.5** Mass assignment na importação de dados de conta — `account/data/import/route.ts:19-49` espalha `...rest` sem whitelist Zod (escopo limitado ao próprio usuário).

**8.6** `characterId` arbitrário aceito em `logs/route.ts:26-35` — cliente pode atribuir log a personagem de outro usuário.

**8.7** Comparação de API key não constant-time (`apiKey !== secret`) e rate-limit de API externa compartilhado entre todos os consumidores — `external-auth.ts:25,34-58`.

**Verificações que NÃO encontraram problema:** todos os `$queryRaw`/`$executeRaw` usam tagged templates parametrizados ou strings estáticas (sem SQL injection); nenhum secret hardcoded no código-fonte; JWT exige `NEXTAUTH_SECRET` ≥32 chars em produção com cookie HttpOnly+SameSite=Lax(+Secure); a grande maioria das rotas de IDOR potencial (`fits/[id]`, `characters/[id]/tags`, `notifications`, `settings`, `contacts`, `esi/fittings`, `analytics/mining/overview`) verifica propriedade corretamente.

---

## Notas finais

- O refactor de criptografia de tokens em andamento (`src/lib/crypto/**`) foi revisado en passant pelos agentes de Characters/ESI e Segurança: a introdução de `encryptToken`/`decryptToken` está consistente nos caminhos de leitura/escrita revisados, sem problema de segurança introduzido. Vale conferir manualmente se todos os pontos que leem `character.accessToken` de `include` fazem o decrypt manual necessário (a extensão Prisma não intercepta certas queries `findFirst`/`findMany` com include, conforme comentários já existentes em `analytics/performance/route.ts` e `pi/colonies/route.ts`).
- Vários achados apontam para o mesmo padrão recorrente que a base já sofreu antes: **fórmulas financeiras (gross/net/ISK-por-hora) reimplementadas de forma levemente diferente em múltiplos arquivos**, sem uma função central compartilhada. Isso aparece nas seções 1, 2, 6 e 7 de forma independente — pode valer uma consolidação arquitetural futura (helper único `getFinancialMetrics`/`iskPerHour` reutilizado em sync, KPIs, hooks e admin).
- Vários endpoints administrativos/debug sem autenticação (`admin/migrate`, `admin/sync`, `admin/sync-charges`, `admin/repair`, `admin/repair/activate-fits`, `debug/sync-all`, `debug/sync-tags`, `debug/db-check`) sugerem que talvez tenham sido criados como scripts one-shot e esquecidos como rotas HTTP públicas — recomenda-se uma varredura rápida específica para confirmar se algum outro endpoint "de manutenção" foi deixado sem `withAuth`.
