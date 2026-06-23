
# Agendamento Online para Clientes — MVP

🟡 Plano para entregar em **homologação** (Share Preview) antes de liberar produção. Tudo é reversível por flag (`agendamento_online_ativo`) e não impacta oficinas que não ativarem.

---

## Visão geral

```text
[Cliente] ──/agendar/:slug──▶ [Página pública]
                                    │
                                    ▼
                       solicitar_agendamento_publico (RPC)
                                    │
                                    ▼
                       solicitacoes_agendamento (status=pendente)
                                    │
            ┌───────────────────────┼─────────────────────────┐
            ▼                       ▼                         ▼
       Aprovar                  Recusar                  Sugerir
       └ cria OS                └ motivo                 └ nova data/hora
       └ status=aprovado        └ status=recusado        └ status=sugerido
                                    │
                                    ▼
                       WhatsApp automático ao cliente
                       (mensagens configuradas pela oficina)
```

Aproveita 100% do que já existe: `catalogo_servicos`, `oficina_configuracoes`, `ordens_servico`, RPCs atômicas, portal público com `SECURITY DEFINER`, calendário date-fns, shadcn UI, `openWhatsAppAgendamento`.

---

## ETAPA 1 — Banco e RPCs

### 1.1 Migração schema

**`oficina_configuracoes`** (novas colunas):
- `agendamento_online_ativo` boolean default false
- `agendamento_online_slug` text unique (índice único parcial onde não nulo)
- `agendamento_online_horarios` jsonb default `'{"seg":{"abre":"08:00","fecha":"18:00","pausa_inicio":"12:00","pausa_fim":"13:00"}, ...}'`
- `agendamento_online_capacidade_simultanea` int default 1
- `agendamento_online_duracao_slot_minutos` int default 30
- `agendamento_online_servicos_permitidos` uuid[] default `'{}'`
- `agendamento_online_mensagem_confirmacao` text
- `agendamento_online_mensagem_aprovacao` text
- `agendamento_online_mensagem_recusa` text
- `agendamento_online_mensagem_sugestao` text
- `agendamento_online_dias_antecedencia_max` int default 30

Trigger de validação (não CHECK, conforme regra do projeto): slug `^[a-z0-9-]{3,40}$`, capacidade ≥ 1, duração entre 15 e 240, datas válidas no JSONB.

**`ordens_servico`**:
- adicionar valor permitido `'solicitado'` em `validar_transicao_status_os` (transições: `solicitado → pendente | cancelado`)
- coluna `solicitacao_agendamento_id` uuid nullable

**Nova tabela `solicitacoes_agendamento`**:
```text
id, oficina_id, cliente_nome, cliente_telefone, cliente_email,
veiculo_placa, veiculo_modelo, servico_id,
data_agendamento_solicitada, hora_agendamento_solicitada,
observacoes_cliente, status (text + trigger valida enum),
data_aprovacao, data_recusa, data_sugestao,
nova_data_sugerida, nova_hora_sugerida, motivo_recusa,
ordem_servico_id, ip_solicitante (inet), created_at, updated_at
```
Índices: `(oficina_id, status, created_at desc)`, `(oficina_id, data_agendamento_solicitada)`.

**RLS**:
- `solicitacoes_agendamento`: SELECT/UPDATE/DELETE só com `has_oficina_access`. INSERT bloqueado para `authenticated` e `anon` — entradas só via RPC `SECURITY DEFINER`.

### 1.2 RPCs `SECURITY DEFINER`

1. **`get_oficina_publica_by_slug(p_slug text)`** — retorna nome, logo, telefone, lista de serviços permitidos, horários, duração de slot, antecedência. Anon-friendly. Sem dados sensíveis.

2. **`get_slots_disponiveis(p_oficina_id uuid, p_data date, p_duracao_minutos int)`** — gera slots a partir de `horarios` do dia, subtrai bloqueios por:
   - OS existentes no dia (`data_servico = p_data` + `hora_agendamento`)
   - Solicitações `pendente`/`aprovado`/`sugerido` no dia
   - Capacidade simultânea
   - Pausas configuradas
   Retorna array `time[]` de horários livres.

3. **`solicitar_agendamento_publico(p_slug, p_cliente_nome, p_telefone, p_email, p_placa, p_modelo, p_servico_id, p_data, p_hora, p_observacoes, p_ip_hash)`**:
   - Valida slug existe + `ativo=true`
   - Valida serviço pertence a `servicos_permitidos`
   - Re-valida slot disponível (anti-race)
   - Rate-limit via `rate_limit_log` (max 3/hora por `ip_hash`, 5/dia por telefone)
   - Sanitiza inputs (trim, lengths)
   - Insere `solicitacoes_agendamento` status `pendente`
   - Insere `notificacoes` para oficina
   - Retorna `{id, mensagem_confirmacao}`

4. **`aprovar_solicitacao_agendamento(p_id uuid)`**:
   - Valida oficina via `has_oficina_access`
   - Acquire advisory lock por solicitação (evita duplo-aprovar)
   - Cria OS via lógica reutilizada de `criar_os_completa` (cliente novo ou existente por telefone, veículo novo ou existente por placa), status `solicitado`, item de serviço pré-preenchido com o serviço do catálogo
   - Atualiza solicitação: status `aprovado`, `data_aprovacao`, `ordem_servico_id`
   - Retorna `{ordem_servico_id, numero, mensagem_aprovacao}`

5. **`recusar_solicitacao_agendamento(p_id uuid, p_motivo text)`** — status `recusado` + motivo.

6. **`sugerir_novo_horario_agendamento(p_id uuid, p_nova_data date, p_nova_hora time)`** — status `sugerido` + novas datas. Solicitação volta para `pendente` se cliente aceitar (fora do MVP — botão "Aceitar nova data" virá na v2 via link público de retomada).

7. **`cancelar_solicitacao_agendamento(p_id uuid)`** — pela oficina.

8. **`buscar_solicitacao_publica(p_token uuid)`** (v2, opcional já no MVP se sobrar tempo) — cliente acompanha sua solicitação.

---

## ETAPA 2 — UI Oficina

### 2.1 Configurações (`src/pages/Configuracoes.tsx` — nova aba "Agendamento Online")

Componente novo `src/components/configuracoes/AgendamentoOnlineModal.tsx`:
- Switch ativar/desativar (gate visual quando inativo)
- Campo slug com debounce de verificação de unicidade + preview da URL completa + botão "Copiar link"
- Grid 7 linhas (seg-dom): switch "Aberto", inputs hora abre/fecha, pausa opcional
- Inputs: duração do slot (15/30/45/60/90), capacidade simultânea, antecedência máx (dias)
- Multi-select de serviços (reaproveitar `catalogo_servicos` filtrado por `ativo`)
- 4 textareas de mensagens com placeholders `{{cliente_nome}} {{servico}} {{data}} {{hora}} {{oficina}}` + preview ao vivo
- Sticky footer (regra mobile), validateForm síncrono

Hook novo `src/hooks/useAgendamentoOnlineConfig.ts`.

### 2.2 Página "Solicitações de Agendamento"

Nova rota `/solicitacoes` registrada em `App.tsx`, link no `Sidebar` e `BottomNav` com badge contagem de pendentes (via `useNotificacoes` ou query dedicada com Realtime subscription em `solicitacoes_agendamento`).

Componente `src/pages/SolicitacoesAgendamento.tsx`:
- Tabs por status: Pendentes / Aprovadas / Sugeridas / Recusadas
- Cards mobile-first: nome, telefone (tap-to-call), serviço, data/hora, veículo, observações
- Ações no card: **Aprovar** (1-tap), **Sugerir outro horário** (drawer com calendário + slots), **Recusar** (drawer com motivo)
- Após ação: toast rico + opção "Enviar WhatsApp agora" usando `openWhatsAppAgendamento` adaptado
- Adaptive: Drawer mobile, Dialog desktop

### 2.3 Agenda interna

Em `MobileAgenda.tsx` e `Agenda.tsx`:
- Carregar também solicitações `pendente`/`aprovado`/`sugerido` do mês e renderizar pontinho de cor distinta (warning para pendentes)
- Tap em dia → seção extra "Solicitações neste dia" acima da lista de OS
- OS criadas a partir de aprovação aparecem normalmente (status `solicitado` → badge "Agendamento confirmado")

### 2.4 Notificações

- Trigger AFTER INSERT em `solicitacoes_agendamento` → INSERT em `notificacoes` (`tipo='agendamento_solicitado'`)
- Subscription Supabase Realtime na página de solicitações para refletir novas em tempo real
- `BottomNav` mostra badge com pendentes (reaproveita padrão de `useMobileAlertBadges`)

---

## ETAPA 3 — UI Cliente (página pública)

Nova rota `/agendar/:slug` em `App.tsx` (pública, fora de `ProtectedRoute`).

Componente `src/pages/AgendamentoPublico.tsx` — wizard 4 passos:

**Passo 1 — Serviço**: cards grandes (toque) com nome + duração estimada + valor (opcional, mostrar só se `mostrar_precos` no JSONB de config — default true).

**Passo 2 — Data e horário**: calendário (reutiliza `Calendar` shadcn com `pointer-events-auto`). Datas indisponíveis (fora do `dias_funcionamento` ou além de `dias_antecedencia_max`) ficam disabled. Ao selecionar data: chama `get_slots_disponiveis` → grid de chips de horário.

**Passo 3 — Dados**: nome*, telefone* (máscara BR + normalização), email, placa, modelo, observações. Validação Zod no submit.

**Passo 4 — Revisão e envio**: resumo + checkbox LGPD + botão "Solicitar". Cloudflare Turnstile ou hCaptcha como anti-abuso (free tier). Rate-limit no backend como segunda camada.

**Pós-envio**: tela de sucesso com mensagem configurada + botão "Abrir WhatsApp da oficina" (deep-link `wa.me` pré-preenchido se telefone da oficina existir).

Mobile-first, sem header do app, identidade visual da oficina (logo + nome), `text-base` em inputs, sticky footer.

### 3.1 WhatsApp do cliente

Como o navegador do cliente não consegue disparar WhatsApp sozinho de forma silenciosa, o MVP usa:
- **Cliente recebe**: na tela final, botão grande "Abrir conversa com a oficina" que abre `wa.me/<telefone>` com a mensagem de confirmação pré-preenchida (clipboard fallback).
- **Oficina envia**: ao aprovar/recusar/sugerir, o sistema mostra modal "Enviar WhatsApp?" com mensagem montada — 1 toque dispara `openWhatsAppAgendamento`. Mantém o controle e zero custo de gateway.

Envio automático via API (Twilio/WhatsApp Cloud) fica fora do MVP — exige conta Meta e número aprovado.

---

## ETAPA 4 — Validação obrigatória (auditoria explícita)

Conforme regra `comunicacao-auditoria-explicita`, cada item será narrado com evidência:

1. **Configuração**: criar oficina teste, definir slug "teste-mvp", horários seg-sex 08-18 com pausa 12-13, 2 serviços, capacidade 2, slot 30min. Conferir uniqueness do slug (tentar duplicar).
2. **Cliente**: abrir `/agendar/teste-mvp` em aba anônima, agendar, conferir que slot escolhido some do `get_slots_disponiveis` em chamada subsequente.
3. **Oficina**: receber notificação realtime, aprovar, conferir OS criada com `status='solicitado'` e `solicitacao_agendamento_id` preenchido.
4. **Conflitos**: tentar agendar mesmo horário 3x — terceira deve falhar por capacidade=2. Tentar fora do expediente — slot não aparece. Tentar 35 dias à frente com antecedência=30 — data disabled.
5. **Rate-limit**: 4ª solicitação no mesmo IP em 1h retorna erro humanizado.
6. **Sugerir/Recusar**: WhatsApp abre com texto correto + variáveis substituídas.
7. **Linter Supabase + Sentry** rodando limpos.

Capturas via browser tool serão anexadas no relatório final.

---

## Riscos e mitigações

| Risco | Mitigação |
|---|---|
| Cliente cria placa/cliente duplicado | `aprovar_solicitacao` faz match por telefone (cliente) e placa normalizada (veículo) antes de criar — reusa `normalizacao-telefones-brasileiros` |
| Race condition em slot | `get_slots_disponiveis` chamado de novo dentro da RPC `solicitar_*` sob advisory lock por `(oficina_id, data, hora)` |
| Abuso/spam | Turnstile + rate_limit_log (IP+telefone) + tabela RLS-blocked para anon insert |
| Slug colidir com rota existente | Lista de reservados (`auth`, `app`, `admin`, `os`, `orcamento`, `cliente`, `agendar`) bloqueada no trigger |
| Quebra de OS existentes ao adicionar status `solicitado` | Apenas adiciona transição nova; nenhum código atual filtra contra ela. Audit `rg "status.*=.*'solicitado'"` antes do deploy |
| Performance no calendário público | `get_slots_disponiveis` indexado em `(oficina_id, data_servico)` + cache 30s no React Query |

---

## Detalhes técnicos (para devs)

- **Frontend**: React 18 + Vite + Tailwind + shadcn + framer-motion + date-fns + Embla (carrossel de slots se necessário). Sem libs novas obrigatórias.
- **Anti-abuso**: Cloudflare Turnstile (free, sem cadastro custoso) — site key como `VITE_*` pública, secret como Supabase secret usado em edge function `verify-turnstile` que retorna token validado consumido pela RPC.
- **Tipagem RPC**: registrar todas as 7 novas RPCs em `src/lib/rpcTypes.ts` (regra `tipagem-rpc-centralizada`).
- **Realtime**: `ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitacoes_agendamento;`
- **Auto-save**: `useAutoSave` no wizard público (chave por `slug`).
- **Z-index**: drawers de aprovação respeitam `hierarquia-z-index-mobile-layers`.
- **Datas**: sufixo `T12:00:00` ao parsear (regra timezone).

---

## Entrega faseada sugerida

- **Fase 1 (1-2 dias)**: Etapa 1 completa + Etapa 2.1 (config) + Etapa 2.2 (gestão interna sem realtime). Permite oficina cadastrar e gerenciar solicitações fake manualmente.
- **Fase 2 (1-2 dias)**: Etapa 3 (wizard público) + WhatsApp + Turnstile.
- **Fase 3 (0,5-1 dia)**: Realtime + badge + integração na agenda + auditoria completa Etapa 4.

Total: **3-5 dias** para MVP em homologação.

---

🟡 Aprove para eu iniciar a Fase 1 (migration + config oficina). Não publico em produção até você validar com Joel/Priscila no Share Preview.
