# Edge Functions Matrix — Mechanic Raiz Pro
**Gerado em:** 2026-07-18  
**Branch:** migration/supabase-cutover-prep  
**Total local:** 28 diretórios em `supabase/functions/`  
**Total no projeto novo:** 6 (ACTIVE)

---

## Status por Function

### GRUPO A — Core já publicado no projeto novo

| Function | Status no novo | verify_jwt | Secrets necessários | Tabelas/RPCs | Dependência externa | Observações |
|----------|---------------|-----------|--------------------|--------------|--------------------|-------------|
| `mercadopago-webhook` | ✅ ACTIVE (v8) | false | `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` | `oficinas`, `orcamentos`, `pagamentos`, `subscriptions`, `notificacoes`, `funnel_events` | `api.mercadopago.com` | **ATENÇÃO:** contém `DEBUG ENV keys` e `DEBUG MP_ACCESS_TOKEN` — remover antes de deploy final de produção |
| `mercadopago-create-preference` | ✅ ACTIVE (v5) | true | `MP_ACCESS_TOKEN` | `oficinas` | `api.mercadopago.com/checkout/preferences` | `RESEND_API_KEY` **não** é usado aqui |
| `verify-payment-status` | ✅ ACTIVE (v5) | true | `MP_ACCESS_TOKEN` | `pagamentos`, `subscriptions` | `api.mercadopago.com` | Chama RPC `has_oficina_access` — confirmada existente |
| `send-password-reset` | ✅ ACTIVE (v5) | true | `RESEND_API_KEY` ⚠️ (nome errado no projeto novo) | Nenhuma (usa Auth Admin API) | `api.resend.com` | URL base hardcoded `mechanicraizpro.lovable.app` — **trocar** |
| `send-team-invite` | ✅ ACTIVE (v5) | true | `RESEND_API_KEY` ⚠️ | `oficinas`, `profiles` | `api.resend.com` | URL base hardcoded `mechanicraizpro.lovable.app` — **trocar** |
| `idempotency-guard` | ✅ ACTIVE (v5) | true | Nenhum customizado | `ordens_servico`, `financeiro`, `estoque`, `estoque_movimentacoes`, `idempotency_keys` | Nenhuma | Pronto para produção após validação de schema |

### GRUPO B — Não publicados ainda

| Function | Prioridade | Secrets necessários | Status de dependências | Ação recomendada |
|----------|-----------|--------------------|-----------------------|-----------------|
| `sentinela-detector` | 🟡 Média | `RESEND_API_KEY`, `SENTINELA_ALERT_EMAIL` | Tabelas OK (verificar após auditoria) | URLs hardcoded `lovable.app` — corrigir antes do deploy |
| `system-health-check` | 🟡 Média | `INTERNAL_SECRET` ❌ ausente | `INTERNAL_SECRET` pendente | Aguardar valor do usuário |
| `send-custom-email` | 🟡 Média | `RESEND_API_KEY` ⚠️, `INTERNAL_SECRET` ❌ | Dois secrets pendentes | Aguardar ambos |
| `send-welcome-email` | 🟡 Média | `RESEND_API_KEY` ⚠️ | Nome errado | Corrigir RESEND primeiro |
| `send-trial-emails` | 🟡 Média | `RESEND_API_KEY` ⚠️ | Nome errado | Corrigir RESEND primeiro |
| `send-trial-urgency-emails` | 🟡 Média | `RESEND_API_KEY` ⚠️ | Nome errado | Corrigir RESEND primeiro |
| `send-achievement-email` | 🟢 Baixa | `RESEND_API_KEY` ⚠️ | Nome errado | Corrigir RESEND primeiro |
| `send-14-dias-announcement` | 🟢 Baixa | `RESEND_API_KEY` ⚠️ | Nome errado | Corrigir RESEND primeiro |
| `send-auto-eletrica-announcement` | 🟢 Baixa | `RESEND_API_KEY` ⚠️ | Nome errado | Corrigir RESEND primeiro |
| `send-followup-email` | 🟢 Baixa | `RESEND_API_KEY` ⚠️ | Nome errado | Leads marketing |
| `recover-legacy-users` | 🟢 Baixa | `RESEND_API_KEY` ⚠️ | Nome errado | Uso pontual |
| `ingest-legacy-data` | 🟢 Baixa | `MIGRATION_SHARED_TOKEN` ❌ | Pendente | Uso pontual de migração |

### DEPENDÊNCIAS EXTERNAS — Decisão necessária

| Function | Dependência | Status recomendado |
|----------|-------------|------------------|
| `capi-proxy` | `marketing-tracking.lovable.app` (CAPI Meta) | ⏸️ Aguardar decisão sobre tracking |
| `landing-chatbot` | `ai.gateway.lovable.dev` (Lovable AI) | 🔄 Refatorar para OpenAI ou feature-flag off |
| `sync-lead-on-signup` | `odhdronjiiczxyeqtiha.supabase.co` (Lead Finder) | ⏸️ Aguardar decisão sobre Lead Finder |
| `send-leads-to-finder` | `odhdronjiiczxyeqtiha.supabase.co` | ⏸️ Aguardar decisão |
| `recover-expired-leads` | `odhdronjiiczxyeqtiha.supabase.co` | ⏸️ Aguardar decisão |
| `campaign-reactivation` | `odhdronjiiczxyeqtiha.supabase.co` + `RESEND_API_KEY` | ⏸️ Aguardar decisão |
| `auto-followup-leads` | `RESEND_API_KEY` + lógica de leads | 🟡 Após RESEND corrigido |
| `check-lead-engagement` | `RESEND_API_KEY` + lógica de leads | 🟡 Após RESEND corrigido |

### OBSOLETAS — NÃO deployar

| Function | Motivo |
|----------|--------|
| `admin-set-password` | Inertizada por auditoria de segurança — retorna 403 sempre |
| `meta-capi-purchase` | Arquivada — retorna 410 Gone, mantida apenas para detectar chamadores |

---

## Problemas Identificados no Grupo A (já publicado)

### 1. DEBUG logs expõem variáveis de ambiente
**Arquivo:** `mercadopago-webhook/index.ts:280-281`  
```typescript
console.log("DEBUG MP_ACCESS_TOKEN existe:", !!mpAccessToken);
console.log("DEBUG ENV keys:", Object.keys(Deno.env.toObject()));
```
**Impacto:** A lista completa de variáveis de ambiente fica visível nos logs — inclui nomes de todos os secrets. Não expõe valores, mas expõe nomes.  
**Ação:** Remover antes de finalizar a migração para produção. **Não urgente agora.**

### 2. URLs hardcoded `mechanicraizpro.lovable.app`
**Arquivos:**
- `send-password-reset/index.ts:102` — URL base para links de reset
- `send-team-invite/index.ts:7` — URL base para links de convite

**Impacto:** Emails enviados pelo projeto novo vão apontar para o domínio antigo (Lovable).  
**Ação:** Trocar para `https://www.mechanicraizpro.com.br` antes da virada. Candidato a env var (`APP_BASE_URL`) ou constante centralizada.

### 3. `RESEND_API_CHAVE` vs `RESEND_API_KEY`
**Impacto:** `send-password-reset` e `send-team-invite` já estão no ar no projeto novo mas **emails não funcionam** porque o secret tem nome errado.  
**Ação:** Corrigir o nome do secret no projeto novo. Ver Fase 2 (secrets-matrix).

---

## Sequência de Deploy Recomendada (após GATE 1 e GATE 2)

**Lote 1** (após corrigir RESEND e URLs):
- `mercadopago-webhook` — redeploy para remover DEBUG logs
- `send-password-reset` — redeploy após corrigir RESEND + URL
- `send-team-invite` — redeploy após corrigir RESEND + URL

**Lote 2** (após INTERNAL_SECRET disponível):
- `system-health-check`
- `send-custom-email`
- `sentinela-detector` (após corrigir URLs + SENTINELA_ALERT_EMAIL)

**Lote 3** (após schema e dados validados):
- `send-welcome-email`, `send-trial-emails`, `send-trial-urgency-emails`
- `send-achievement-email`, `send-14-dias-announcement`, `send-auto-eletrica-announcement`
- `send-followup-email`, `auto-followup-leads`, `check-lead-engagement`
- `recover-legacy-users`, `ingest-legacy-data`

**Bloqueadas até decisão:**
- `capi-proxy`, `landing-chatbot`
- `sync-lead-on-signup`, `send-leads-to-finder`, `recover-expired-leads`, `campaign-reactivation`

**Não deployar:**
- `admin-set-password`, `meta-capi-purchase`
