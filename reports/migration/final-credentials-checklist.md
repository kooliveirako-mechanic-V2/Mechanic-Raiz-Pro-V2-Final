# Final Credentials Checklist — Cutover
**Projeto novo:** `kurlgmngmglhvknwxjee`  
**Gerado em:** 2026-07-18

Somente as credenciais necessárias para o **primeiro cutover**. Integrações adiadas (Lead Finder, Meta CAPI, chatbot, campanhas) não estão nesta lista.

---

## Secrets do Supabase Novo (Edge Functions)

Cadastrar em: Supabase Dashboard → Edge Functions → Secrets

| # | Secret | Onde cadastrar | Quem usa | Por que é necessário | Pode esperar até o dia da virada? |
|---|--------|---------------|----------|---------------------|----------------------------------|
| 1 | `RESEND_API_KEY` | Supabase novo → Secrets | `send-password-reset`, `send-team-invite`, `sentinela-detector` + 10 outros | Sem ele, reset de senha e convite de equipe não funcionam | ❌ Não — crítico para login |
| 2 | `MP_WEBHOOK_SECRET` | Supabase novo → Secrets | `mercadopago-webhook` | Valida assinatura HMAC do Mercado Pago. **Atenção:** o valor muda quando a URL do webhook é trocada no painel do MP | ✅ Sim — atualizar no momento da virada |
| 3 | `INTERNAL_SECRET` | Supabase novo → Secrets | `system-health-check`, `send-custom-email` | Autentica chamadas internas. Pode ser qualquer string segura | ✅ Sim — não bloqueia operação core |

**Secrets já configurados corretamente:**
- `MP_ACCESS_TOKEN` — já existe com nome correto
- Todos os secrets automáticos do Supabase (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, etc.)

**Problema pendente a resolver ANTES do cutover:**
- `RESEND_API_CHAVE` (nome errado) → criar `RESEND_API_KEY` com o mesmo valor, depois remover `RESEND_API_CHAVE`

---

## Variáveis da Vercel (Frontend)

Alterar em: Vercel → Settings → Environment Variables → **Production only**

| # | Variável | Valor atual (antigo) | Valor novo | Quando alterar |
|---|----------|---------------------|-----------|---------------|
| 1 | `VITE_SUPABASE_URL` | `https://cuhkkoqqeguascdsvtky.supabase.co` | `https://kurlgmngmglhvknwxjee.supabase.co` | Momento do cutover |
| 2 | `VITE_SUPABASE_PUBLISHABLE_KEY` | anon key do antigo | anon key do novo | Momento do cutover |

**Nota:** `VITE_SUPABASE_PROJECT_ID` não é consumida pelo frontend — não adicionar.

---

## Configurações de Dashboard (não são secrets de código)

| # | Item | Onde configurar | Ação |
|---|------|----------------|------|
| 1 | URL do webhook Mercado Pago | Painel MP → Webhooks → Produção | Trocar para URL do Supabase novo |
| 2 | Google OAuth callback | Google Cloud Console + Supabase novo → Auth → Providers → Google | Adicionar `https://kurlgmngmglhvknwxjee.supabase.co/auth/v1/callback` |
| 3 | Site URL no Supabase novo | Supabase novo → Auth → URL Configuration | Definir `https://www.mechanicraizpro.com.br` |
| 4 | Redirect URLs no Supabase novo | Supabase novo → Auth → URL Configuration | Adicionar `https://www.mechanicraizpro.com.br/**` |

---

## Como testar cada credencial

| Secret | Como testar sem afetar produção |
|--------|--------------------------------|
| `RESEND_API_KEY` | `supabase functions invoke send-password-reset` com email de teste próprio |
| `MP_WEBHOOK_SECRET` | Usar "Simular notificação" no painel MP após a virada, verificar logs |
| `INTERNAL_SECRET` | `curl -H "x-internal-secret: <valor>" <url>/functions/v1/system-health-check` |
| Vercel envs | Configurar em Preview primeiro, testar com branch de migração antes de alterar Production |

---

## Integrações adiadas (não incluir no primeiro cutover)

- `LOVABLE_API_KEY` — substituir por `OPENAI_API_KEY` após landing-chatbot ser refatorado
- `LEADS_SECRET` — aguardar decisão sobre capi-proxy
- `RECEIVE_LEADS_TOKEN` / `RECEBER_TOKEN_DE_LEADS` — aguardar decisão sobre Lead Finder
- `SENTINELA_ALERT_EMAIL` — não crítico para operação
- `MIGRATION_SHARED_TOKEN` — uso pontual, não de operação contínua
