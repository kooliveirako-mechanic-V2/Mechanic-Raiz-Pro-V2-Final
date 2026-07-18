# Cutover Runbook — Mechanic Raiz Pro → Supabase Novo
**Projeto antigo:** `cuhkkoqqeguascdsvtky`  
**Projeto novo:** `kurlgmngmglhvknwxjee`  
**Domínio:** `https://www.mechanicraizpro.com.br`

---

## Pré-requisitos (validar ANTES de marcar hora da virada)

- [ ] Schema auditado e divergências resolvidas (GATE 1)
- [ ] Auth: 35+ usuários com hashes e identities validados
- [ ] Storage: script de migração executado e validado com dry-run
- [ ] Edge Functions: todas do Grupo A deployadas e smoke-testadas
- [ ] Secrets: `RESEND_API_KEY`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_SECRET` cadastrados
- [ ] Google OAuth: callback configurado no Supabase novo e no Google Cloud Console
- [ ] Branch `migration/remove-lovable-auth` revisada e aprovada
- [ ] `.env.production.migration.example` revisado com valores corretos
- [ ] Vercel: variáveis de Preview apontando para Supabase novo e testadas
- [ ] Rollback testado em ambiente de preview (não produção)
- [ ] Comunicação interna: equipe avisada sobre janela de manutenção

---

## Janela Recomendada

**Horário:** Madrugada (00:00–04:00 BRT) com baixo tráfego  
**Duração estimada:** 30–60 minutos (mais até 2h de monitoramento)  
**Responsáveis:** 1 pessoa no painel do Supabase + 1 pessoa no Vercel + 1 pessoa no Mercado Pago

---

## Passo a Passo (minuto a minuto)

### T-60min — Preparação

- [ ] Abrir em abas: Supabase antigo, Supabase novo, Vercel, Mercado Pago, logs do Supabase novo
- [ ] Verificar que produção antiga está estável (sem erros nos logs)
- [ ] Executar `scripts/migration/data-parity.sql` nos dois projetos e comparar
- [ ] Confirmar que não há pagamentos em andamento ou OS abertas críticas

### T-0 — Backup final e delta

```bash
# 1. Backup final do antigo
supabase db dump --project-ref cuhkkoqqeguascdsvtky > backup_final_$(date +%Y%m%d_%H%M).sql

# 2. Backup do novo (estado atual)
supabase db dump --project-ref kurlgmngmglhvknwxjee > backup_novo_pre_cutover_$(date +%Y%m%d_%H%M).sql
```

- [ ] Backups salvos em local seguro fora do repo

### T+5 — Storage: migração dos arquivos novos

```bash
# Migrar apenas arquivos criados após o backup inicial (2026-07-16)
deno run --allow-env --allow-net --allow-write --allow-read \
  scripts/migration/migrate-storage.ts \
  --resume --concurrency 5
```

- [ ] Verificar relatório `reports/migration/storage-manifest.json`
- [ ] Confirmar 0 falhas (ou investigar falhas antes de continuar)

### T+15 — Auth: delta de novos usuários

```bash
# Comparar usuários antigo vs novo
deno run --allow-env --allow-net --allow-write \
  scripts/migration/audit-auth.ts
```

- [ ] Verificar `reports/migration/auth-parity.md`
- [ ] Se houver usuários novos ausentes no novo: investigar antes de prosseguir

### T+20 — Deploy final das Edge Functions

```bash
cd C:\Users\Hp\mechanic-raiz-pro-audit

# Grupo A — já publicado, redeploy para pegar código atualizado
supabase functions deploy mercadopago-webhook --project-ref kurlgmngmglhvknwxjee
supabase functions deploy mercadopago-create-preference --project-ref kurlgmngmglhvknwxjee
supabase functions deploy verify-payment-status --project-ref kurlgmngmglhvknwxjee
supabase functions deploy send-password-reset --project-ref kurlgmngmglhvknwxjee
supabase functions deploy send-team-invite --project-ref kurlgmngmglhvknwxjee
supabase functions deploy idempotency-guard --project-ref kurlgmngmglhvknwxjee
```

- [ ] Confirmar todas ACTIVE: `supabase functions list`

### T+25 — Virada do Frontend (Vercel)

**Na Vercel — Settings → Environment Variables → Production:**

1. Alterar `VITE_SUPABASE_URL`: `https://cuhkkoqqeguascdsvtky.supabase.co` → `https://kurlgmngmglhvknwxjee.supabase.co`
2. Alterar `VITE_SUPABASE_PUBLISHABLE_KEY`: valor antigo → anon key do projeto novo

- [ ] Salvar variáveis
- [ ] Trigger de redeploy: Vercel → Deployments → "Redeploy" no commit atual

### T+30 — Virada do Webhook Mercado Pago

**No painel do Mercado Pago — Webhooks → Produção:**

- Trocar URL de `https://cuhkkoqqeguascdsvtky.supabase.co/functions/v1/mercadopago-webhook`  
  para `https://kurlgmngmglhvknwxjee.supabase.co/functions/v1/mercadopago-webhook`
- Copiar a nova assinatura secreta gerada
- Atualizar `MP_WEBHOOK_SECRET` no Supabase novo: `supabase secrets set MP_WEBHOOK_SECRET=<nova>`
- [ ] Salvar configurações

### T+35 — Aguardar deploy da Vercel

- [ ] Status na Vercel: `Ready`
- [ ] Abrir `https://www.mechanicraizpro.com.br` em aba anônima
- [ ] Confirmar que a página carrega

---

## Smoke Tests (T+35 a T+50)

### Autenticação
- [ ] Login com email/senha de conta de teste
- [ ] Login com Google (conta de teste)
- [ ] Recuperação de senha (verificar email chegou)

### Core do sistema
- [ ] Dashboard carrega com dados (oficinas, clientes, OS)
- [ ] Listar clientes
- [ ] Abrir uma OS existente
- [ ] Criar nova OS de teste
- [ ] Acessar financeiro

### Pagamento (se disponível na janela)
- [ ] Criar preferência de pagamento (verificar que vai ao Mercado Pago)
- [ ] Verificar logs do `mercadopago-create-preference` no Supabase novo

### Convite de equipe
- [ ] Enviar convite para email de teste
- [ ] Verificar email chegou

---

## Critérios de Sucesso

Todos os itens abaixo devem estar verdes antes de fechar a janela de manutenção:

- [ ] Login funciona (email e Google)
- [ ] Dashboard mostra dados reais
- [ ] Nenhum erro 500 nos logs do Supabase novo
- [ ] Webhook do Mercado Pago respondendo 200
- [ ] Email de teste recebido

---

## Monitoramento pós-virada (T+60 a T+120)

- [ ] Acompanhar logs do Supabase novo por 1h
- [ ] Verificar Mercado Pago → Webhooks → histórico de entregas
- [ ] Verificar Resend → logs de envio
- [ ] Confirmar que não há reclamações de usuários
