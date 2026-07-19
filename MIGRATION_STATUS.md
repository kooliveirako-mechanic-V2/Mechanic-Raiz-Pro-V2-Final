# Migration Status — Mechanic Raiz Pro → Supabase Novo
**Branch:** `migration/supabase-cutover-prep`  
**Última atualização:** 2026-07-18  
**Projeto antigo (produção):** `cuhkkoqqeguascdsvtky`  
**Projeto novo (destino):** `kurlgmngmglhvknwxjee`

---

## Status por Fase

| Fase | Status | Próximo passo |
|------|--------|--------------|
| 1 — Auditoria schema | 🟡 EM ANDAMENTO | Rodar `scripts/migration/audit_new_project.sql` no SQL Editor do projeto novo e colar resultado |
| 2 — Matriz de secrets | ✅ CONCLUÍDA (auditoria) | Aguardar valor de `RESEND_API_KEY` do usuário; decidir Lead Finder e CAPI |
| 3 — Edge Functions | 🟡 EM ANDAMENTO (inventário) | Corrigir `RESEND_API_CHAVE` → `RESEND_API_KEY`; redeploy Grupo A; aguardar gates |
| 4 — Storage | ⬜ NÃO INICIADA | Aguardar GATE 1 |
| 5 — Auth | ✅ PILOTOS GOOGLE + SENHA APROVADOS | Próximo passo: investigar falhas isoladas por recovery individual, sem reset em massa |
| 6 — Google OAuth / remover Lovable | ✅ PILOTO APROVADO | Não repetir OAuth nesta rodada; avançar depois para usuários restantes |
| 7 — Frontend e Vercel | 🟡 EM ANDAMENTO (template) | Leituras core validadas por grants mínimos; repetir por tela real conforme necessário |
| 8 — Paridade de dados | 🟡 VALIDAÇÃO PARCIAL | Conta real confirmou clientes/veículos/OS/estoque sob RLS sem cross-tenant |
| 9 — Estratégia delta (backup desatualizado) | ⬜ NÃO INICIADA | Aguardar paridade confirmada |
| 10 — Plano de virada e rollback | ⬜ NÃO INICIADA | Aguardar todas as fases anteriores |

---

## Fase 1 — Auditoria Somente Leitura

**Status:** 🟡 EM ANDAMENTO  
**Bloqueio:** Docker não disponível na máquina — impossível usar `supabase db dump` localmente.  
**Solução adotada:** SQL gerado para execução manual no dashboard.

**Ações executadas:**
- Criado `scripts/migration/audit_new_project.sql` — pronto para execução no SQL Editor do Supabase novo
- Auditoria do repositório concluída via grep/leitura de código

**Aguardando do usuário:**
- Resultado da execução do SQL no SQL Editor do projeto `kurlgmngmglhvknwxjee`

**Entregáveis:**
- [x] `scripts/migration/audit_new_project.sql`
- [ ] `reports/migration/schema-audit-new.md` — aguarda resultado do SQL
- [ ] `reports/migration/schema-inventory-new.json` — aguarda resultado do SQL
- [ ] `reports/migration/schema-differences.md` — aguarda resultado do SQL

**GATE 1:** ❌ Não atendido — aguardando resultado da auditoria SQL

---

## Fase 2 — Matriz Real de Secrets

**Status:** ✅ AUDITORIA CONCLUÍDA / 🟡 BLOQUEADA (secrets ausentes)

**Ações executadas:**
- Varredura completa de `Deno.env.get()` em todas as 28 functions
- Varredura de `import.meta.env.*` no frontend
- Varredura de URLs externas hardcoded
- Gerado `reports/migration/secrets-matrix.md`

**Secrets no projeto novo — estado atual:**

| Secret | Status | Ação necessária |
|--------|--------|----------------|
| `MP_ACCESS_TOKEN` | ✅ Correto | Nenhuma |
| `MP_WEBHOOK_SECRET` | ✅ Correto | Verificar se é do projeto novo ou antigo |
| `RESEND_API_CHAVE` | ❌ **Nome errado** | Criar `RESEND_API_KEY` com mesmo valor; depois remover `RESEND_API_CHAVE` |
| `RESEND_API_KEY` | ❌ Ausente | Solicitar valor ao usuário |
| `INTERNAL_SECRET` | ❌ Ausente | Solicitar valor ao usuário |
| `SENTINELA_ALERT_EMAIL` | ❌ Ausente | Solicitar email de destino |
| `MIGRATION_SHARED_TOKEN` | ❌ Ausente | Baixa prioridade — uso pontual |
| `RECEIVE_LEADS_TOKEN` | ❌ Ausente | Aguardar decisão sobre Lead Finder externo |
| `RECEBER_TOKEN_DE_LEADS` | ❌ Ausente | Idem |
| `LOVABLE_API_KEY` | ❌ Não migrar | Refatorar `landing-chatbot` |
| `LEADS_SECRET` | ❌ Ausente | Aguardar decisão sobre `capi-proxy` |

**Informações necessárias do usuário:**
1. Valor de `RESEND_API_KEY` (mesmo valor de `RESEND_API_CHAVE` atual) — **bloqueia emails**
2. Valor de `INTERNAL_SECRET` — bloqueia `system-health-check` e `send-custom-email`
3. Decisão sobre Lead Finder externo (`odhdronjiiczxyeqtiha.supabase.co`) — continua ou desativa?
4. Decisão sobre `capi-proxy` / `marketing-tracking.lovable.app` — continua ou desativa?
5. Email de destino para `SENTINELA_ALERT_EMAIL`

**Entregáveis:**
- [x] `reports/migration/secrets-matrix.md`
- [ ] `reports/migration/secrets-missing.md`

**GATE 2:** ❌ Não atendido — `RESEND_API_KEY` ausente bloqueia functions de email

---

## Fase 3 — Edge Functions

**Status:** 🟡 EM ANDAMENTO (inventário concluído)

**Ações executadas:**
- Inventário completo das 28 functions locais
- Classificação por grupo, prioridade e dependências
- Gerado `reports/migration/edge-functions-matrix.md`

**Estado no projeto novo:**
- 6 functions publicadas (Grupo A — core)
- 22 functions pendentes de deploy
- 2 functions obsoletas (não deployar: `admin-set-password`, `meta-capi-purchase`)
- 6 functions com decisão externa pendente

**Problemas identificados no Grupo A (já publicado):**
1. `DEBUG ENV keys` em `mercadopago-webhook` — expõe nomes de secrets nos logs
2. URLs hardcoded `mechanicraizpro.lovable.app` em `send-password-reset` e `send-team-invite`
3. `RESEND_API_CHAVE` vs `RESEND_API_KEY` — emails não funcionam

**Entregáveis:**
- [x] `reports/migration/edge-functions-matrix.md`
- [ ] `reports/migration/edge-functions-deploy.md`
- [ ] `scripts/migration/deploy-functions.ps1`
- [ ] `scripts/migration/deploy-functions.sh`

**GATE 3:** ❌ Não atendido — `RESEND_API_KEY` ausente, URLs hardcoded pendentes

---

## Fases 4–10

**Status:** ⬜ NÃO INICIADAS — aguardando GATE 1 (resultado da auditoria SQL)

---

## Quadro Geral de Prontidão

| Área | Pronta | Parcial | Bloqueada | Evidência |
|------|--------|---------|-----------|-----------|
| Schema | — | — | ❌ | Aguardando resultado SQL |
| Dados | — | — | ❌ | Aguardando resultado SQL |
| Auth | ✅ | — | — | Pilotos Google + senha aprovados; reset geral descartado por enquanto |
| Storage | — | — | ❌ | Aguardando auditoria |
| Edge Functions | — | 🟡 6/28 publicadas | — | 3 problemas no Grupo A |
| Secrets | — | 🟡 2/9 corretos | — | RESEND com nome errado |
| OAuth | ✅ | — | — | Piloto Google aprovado no branch `migration/remove-lovable-auth` |
| Frontend | ✅ leituras core | — | — | Conta real carrega 8 clientes, 9 veículos, 14 OS, 0 estoque sob RLS |

**Estratégia oficial atualizada:** preservar todos os usuários existentes; login normal primeiro; recovery individual somente para usuários que realmente falharem.
| Vercel | — | — | ❌ | Não alterar ainda |
| Mercado Pago | — | — | ❌ | Aguardar virada completa |
| Emails | — | — | ❌ | RESEND bloqueado |
| Rollback | — | — | ❌ | Plano a elaborar |

---

## O Que Pode Ser Executado Sem Risco Agora

1. Rodar `scripts/migration/audit_new_project.sql` no SQL Editor (somente leitura)
2. Corrigir `RESEND_API_CHAVE` → `RESEND_API_KEY` no projeto novo (após receber valor)
3. Criar branch `migration/remove-lovable-auth` e iniciar refactor do Google OAuth
4. Auditar consumo de `VITE_SUPABASE_PROJECT_ID` no frontend

## O Que Depende de Credenciais / Decisões

1. Valor de `RESEND_API_KEY` — bloqueia 12 functions de email
2. Valor de `INTERNAL_SECRET`
3. Decisão sobre Lead Finder externo
4. Decisão sobre `capi-proxy` e `marketing-tracking.lovable.app`
5. Service Role Keys de ambos os projetos — para scripts de Storage e Auth
