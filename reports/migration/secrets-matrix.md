# Secrets Matrix — Mechanic Raiz Pro
**Gerado em:** 2026-07-18  
**Branch:** migration/supabase-cutover-prep  
**Método:** varredura completa de `Deno.env.get()`, `import.meta.env.*`, URLs hardcoded

---

## Resumo Executivo

| Categoria | Quantidade |
|-----------|-----------|
| Secrets customizados necessários (Edge Functions) | 9 |
| Secrets automáticos do Supabase (não recriar) | 10 |
| Vars de frontend (Vercel) | 3 |
| Secrets com problema de nome no projeto novo | 1 |
| Secrets dependentes de decisão externa | 3 |

---

## 1. Secrets de Edge Functions — Customizados

### ✅ MP_ACCESS_TOKEN
| Campo | Valor |
|-------|-------|
| Nome exato | `MP_ACCESS_TOKEN` |
| Arquivos | `mercadopago-create-preference/index.ts:105`, `mercadopago-webhook/index.ts:277`, `verify-payment-status/index.ts:33` |
| Obrigatório | Sim — sem ele pagamento não funciona |
| Automático | Não |
| Ambiente | Edge Function (Supabase) |
| Status no projeto novo | ✅ Existe com nome correto |
| Ação | Nenhuma — já configurado |

### ✅ MP_WEBHOOK_SECRET
| Campo | Valor |
|-------|-------|
| Nome exato | `MP_WEBHOOK_SECRET` |
| Arquivos | `mercadopago-webhook/index.ts:111` |
| Obrigatório | Sim — valida assinatura HMAC do webhook |
| Automático | Não |
| Ambiente | Edge Function (Supabase) |
| Status no projeto novo | ✅ Existe com nome correto |
| Ação | Verificar se é o valor do webhook do Supabase novo ou do antigo (URL diferente = assinatura diferente) |

### ⚠️ RESEND_API_KEY / RESEND_API_CHAVE
| Campo | Valor |
|-------|-------|
| Nome esperado pelo código | `RESEND_API_KEY` |
| Nome no projeto novo | `RESEND_API_CHAVE` ← **PROBLEMA** |
| Arquivos | `send-password-reset/index.ts:5`, `send-team-invite/index.ts:4`, `auto-followup-leads/index.ts:4`, `campaign-reactivation/index.ts:4`, `check-lead-engagement/index.ts:4`, `recover-legacy-users/index.ts:28`, `send-14-dias-announcement/index.ts:4`, `send-achievement-email/index.ts:4`, `send-auto-eletrica-announcement/index.ts:3`, `send-custom-email/index.ts:4`, `send-followup-email/index.ts:3`, `send-trial-emails/index.ts:4` |
| Obrigatório | Sim para todos os emails transacionais |
| Status no projeto novo | ❌ Nome errado (`RESEND_API_CHAVE`) |
| Ação | **BLOQUEANTE** — Recuperar valor de `RESEND_API_CHAVE` do projeto novo (via `supabase secrets list` o digest está visível mas não o valor). Solicitar o valor real ao usuário por canal seguro. Criar `RESEND_API_KEY` com o valor correto. SOMENTE DEPOIS remover `RESEND_API_CHAVE`. |

### ⚠️ INTERNAL_SECRET
| Campo | Valor |
|-------|-------|
| Nome exato | `INTERNAL_SECRET` |
| Arquivos | `system-health-check/index.ts:22`, `send-custom-email/index.ts:5` |
| Obrigatório | Sim para health check e email customizado |
| Status no projeto novo | ❌ Ausente |
| Ação | Solicitar valor ao usuário. Pode ser qualquer string segura (é um token interno). |

### ⚠️ MIGRATION_SHARED_TOKEN
| Campo | Valor |
|-------|-------|
| Nome exato | `MIGRATION_SHARED_TOKEN` |
| Arquivos | `ingest-legacy-data/index.ts:13` |
| Obrigatório | Somente para `ingest-legacy-data` (função de uso pontual) |
| Status no projeto novo | ❌ Ausente |
| Ação | Baixa prioridade — função é de migração pontual, não de operação contínua. Solicitar quando for usar. |

### ⚠️ RECEIVE_LEADS_TOKEN / RECEBER_TOKEN_DE_LEADS
| Campo | Valor |
|-------|-------|
| Nome exato | `RECEIVE_LEADS_TOKEN` e `RECEBER_TOKEN_DE_LEADS` (ambos usados em lógica OR) |
| Arquivos | `campaign-reactivation/index.ts:7-8`, `recover-expired-leads/index.ts:18`, `send-leads-to-finder/index.ts:18` |
| Obrigatório | Para integração com Lead Finder externo (`odhdronjiiczxyeqtiha.supabase.co`) |
| Status no projeto novo | ❌ Ausente |
| Ação | **Decisão pendente** — o projeto externo `odhdronjiiczxyeqtiha.supabase.co` continua? Se sim, solicitar tokens. Se não, functions ficam sem deploy na fase inicial. |

### ⚠️ SENTINELA_ALERT_EMAIL
| Campo | Valor |
|-------|-------|
| Nome exato | `SENTINELA_ALERT_EMAIL` |
| Arquivos | `sentinela-detector/index.ts:18` |
| Obrigatório | Não — função degrada graciosamente (só não manda email de alerta) |
| Status no projeto novo | ❌ Ausente |
| Ação | Baixa prioridade. Solicitar email de destino antes de deployar `sentinela-detector`. |

### ❌ LOVABLE_API_KEY
| Campo | Valor |
|-------|-------|
| Nome exato | `LOVABLE_API_KEY` |
| Arquivos | `landing-chatbot/index.ts:167` |
| Endpoint externo | `https://ai.gateway.lovable.dev/v1/chat/completions` |
| Status no projeto novo | ❌ Ausente |
| Ação | **NÃO MIGRAR como solução definitiva.** Refatorar `landing-chatbot` para usar `OPENAI_API_KEY` com fallback. Se `OPENAI_API_KEY` ausente → resposta de erro controlada `{ error: "feature_unavailable" }`. Não criar placeholder vazio. |

### ❌ LEADS_SECRET
| Campo | Valor |
|-------|-------|
| Nome exato | `LEADS_SECRET` |
| Arquivos | `capi-proxy/index.ts:49` |
| Uso | Autoriza chamadas ao proxy de tracking CAPI (`marketing-tracking.lovable.app`) |
| Status no projeto novo | ❌ Ausente |
| Ação | **Decisão pendente** — `marketing-tracking.lovable.app` é um serviço separado da Lovable. Decidir se continua ativo ou se o `capi-proxy` é desativado/substituído. |

---

## 2. Secrets NÃO Encontrados no Código (da lista original)

### MP_PUBLIC_KEY
- **Status:** Não encontrado em nenhuma Edge Function via `Deno.env.get`
- **Uso provável:** Frontend Vercel (chave pública do Mercado Pago para Checkout Pro)
- **Ação:** Confirmar se é usada em `VITE_MP_PUBLIC_KEY` ou similar. **Não criar como secret de Edge Function.**

### META_PIXEL_ACCESS_TOKEN
- **Status:** Não encontrado via `Deno.env.get` nas functions auditadas
- **Uso provável:** Possivelmente no `capi-proxy` ou em configuração do Marketing Oracle via GTM
- **Ação:** Confirmar com grep completo abaixo. Se for usado apenas em `index.html` via GTM, pertence à configuração do Marketing Oracle, não ao Supabase.

### ADMIN_RESET_TOKEN
- **Status:** Não encontrado em nenhuma Edge Function
- **Função `admin-set-password`:** **DESATIVADA** — retorna 403 sempre, confirmado em auditoria anterior
- **Ação:** **NÃO migrar.** Classificar como obsoleto.

---

## 3. Secrets Automáticos do Supabase (NÃO recriar manualmente)

| Secret | Injetado automaticamente |
|--------|-------------------------|
| `SUPABASE_URL` | Sim |
| `SUPABASE_DB_URL` | Sim |
| `SUPABASE_ANON_KEY` | Sim |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim |
| `SUPABASE_PUBLISHABLE_KEYS` | Sim |
| `SUPABASE_SECRET_KEYS` | Sim |
| `SUPABASE_JWKS` | Sim |
| `SB_REGION` | Sim |
| `SB_EXECUTION_ID` | Sim |
| `DENO_DEPLOYMENT_ID` | Sim |

---

## 4. Variáveis de Frontend (Vercel — não são secrets de Edge Function)

| Variável | Arquivo | Ação na migração |
|----------|---------|-----------------|
| `VITE_SUPABASE_URL` | `vite.config.ts:47`, `src/integrations/supabase/client.ts:5` | Trocar para `https://kurlgmngmglhvknwxjee.supabase.co` no momento da virada |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `vite.config.ts:48`, `src/integrations/supabase/client.ts:6` | Trocar para anon key do projeto novo |
| `VITE_SENTRY_DSN` | `src/lib/sentry.ts` | Manter — é do Sentry, não do Supabase |
| `VITE_SUPABASE_PROJECT_ID` | `vite.config.ts:49` | Verificar se é realmente consumida em runtime antes de incluir no template |

---

## 5. URLs Externas Hardcoded (não são secrets)

| URL | Arquivo | Classificação |
|-----|---------|--------------|
| `https://ai.gateway.lovable.dev/v1/chat/completions` | `landing-chatbot/index.ts` | **Dependência Lovable — remover** |
| `https://api.resend.com/emails` | múltiplas functions | OK — serviço externo mantido |
| `https://api.mercadopago.com/checkout/preferences` | `mercadopago-create-preference/index.ts` | OK — serviço externo mantido |
| `https://api.mercadopago.com/v1/payments/{id}` | `mercadopago-webhook/index.ts` | OK |
| `https://marketing-tracking.lovable.app/api/public/capi-event` | `capi-proxy/index.ts:8` | **Decisão pendente** |
| `https://marketing-tracking.lovable.app/t/:code` | `vercel.json:24` | **Decisão pendente** |
| `https://mechanicraizpro.lovable.app` | `send-password-reset/index.ts:102`, `send-team-invite/index.ts:7`, `sentinela-detector/index.ts:132,236`, `AgendamentoOnlineModal.tsx:70` | **Trocar para `https://www.mechanicraizpro.com.br`** |
| `https://mechanicraizpro.lovable.app/~oauth/initiate` | `GoogleSignInButton.tsx:7` | **Remover — parte do refactor de OAuth** |
| `https://odhdronjiiczxyeqtiha.supabase.co/functions/v1/receive-leads` | `campaign-reactivation/index.ts:8`, `recover-expired-leads/index.ts:10`, `send-leads-to-finder/index.ts:10`, `sync-lead-on-signup/index.ts:10` | **Decisão pendente — projeto Lead Finder externo** |

---

## 6. Pendências que Requerem Informação do Usuário

| # | Informação necessária | Para qual secret | Prioridade |
|---|----------------------|-----------------|-----------|
| 1 | Valor de `RESEND_API_KEY` (mesmo valor do `RESEND_API_CHAVE` atual) | `RESEND_API_KEY` | 🔴 Alta — bloqueia emails |
| 2 | Valor de `INTERNAL_SECRET` | `INTERNAL_SECRET` | 🟡 Média — bloqueia health-check e send-custom-email |
| 3 | Decisão sobre Lead Finder (`odhdronjiiczxyeqtiha.supabase.co`) | `RECEIVE_LEADS_TOKEN`, `RECEBER_TOKEN_DE_LEADS` | 🟡 Média |
| 4 | Decisão sobre `capi-proxy` / `marketing-tracking.lovable.app` | `LEADS_SECRET` | 🟡 Média |
| 5 | Chave OpenAI (ou decisão de desativar chatbot) | `OPENAI_API_KEY` | 🟢 Baixa |
| 6 | Email de destino do Sentinela | `SENTINELA_ALERT_EMAIL` | 🟢 Baixa |

---

## GATE 2

Nenhuma function classificada como dependente de secret ausente pode ser declarada pronta até o secret correspondente estar criado e confirmado via `supabase secrets list`.
