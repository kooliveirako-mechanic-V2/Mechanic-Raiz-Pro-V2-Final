# Rollback Runbook — Mechanic Raiz Pro
**Usar quando:** algo der errado durante ou após o cutover e for necessário voltar ao Supabase antigo.

---

## Critérios para acionar o rollback

Acionar imediatamente se qualquer item abaixo for verdadeiro após o cutover:

- Login com email/senha falha para a maioria dos usuários
- Login com Google falha
- Dashboard não carrega dados (tela em branco ou erro 500)
- Webhook do Mercado Pago não entrega (erros 4xx/5xx no painel MP)
- Emails críticos (reset de senha, convite) não chegam
- Erros sistemáticos nos logs do Supabase novo nos primeiros 30 min

---

## Passo a Passo do Rollback

### Passo 1 — Reverter Vercel (2 min)

**Na Vercel — Settings → Environment Variables → Production:**

1. Restaurar `VITE_SUPABASE_URL`: → `https://cuhkkoqqeguascdsvtky.supabase.co`
2. Restaurar `VITE_SUPABASE_PUBLISHABLE_KEY`: → anon key do projeto antigo

- [ ] Trigger de redeploy imediato
- [ ] Aguardar status `Ready` na Vercel

### Passo 2 — Reverter Webhook Mercado Pago (2 min)

**No painel do Mercado Pago — Webhooks → Produção:**

- Restaurar URL para: `https://cuhkkoqqeguascdsvtky.supabase.co/functions/v1/mercadopago-webhook`
- Restaurar assinatura secreta anterior (manter anotada antes do cutover)
- [ ] Salvar configurações

### Passo 3 — Confirmar que produção antiga voltou (5 min)

- [ ] Abrir `https://www.mechanicraizpro.com.br` em aba anônima
- [ ] Fazer login com email/senha
- [ ] Confirmar que dashboard carrega com dados reais
- [ ] Verificar logs do Supabase **antigo** — sem erros

### Passo 4 — Preservar evidências do novo (não apagar)

- [ ] **NÃO apagar** dados criados no Supabase novo durante a janela de cutover
- [ ] Anotar: quais usuários fizeram login no novo? Quais OS foram criadas? Quais pagamentos?
- [ ] Exportar logs do Supabase novo: Edge Functions → Logs → exportar
- [ ] Registrar no `MIGRATION_STATUS.md`: o que aconteceu, quando, e qual foi o problema

### Passo 5 — Reconciliar dados criados durante a tentativa

Se houver dados criados no Supabase novo durante o cutover (novos clientes, OS, financeiro):

```sql
-- Executar no Supabase NOVO para identificar dados criados durante a janela
SELECT 'clientes' AS tabela, count(*) FROM clientes WHERE created_at > '<hora_inicio_cutover>'
UNION ALL SELECT 'ordens_servico', count(*) FROM ordens_servico WHERE created_at > '<hora_inicio_cutover>'
UNION ALL SELECT 'financeiro', count(*) FROM financeiro WHERE created_at > '<hora_inicio_cutover>'
UNION ALL SELECT 'pagamentos', count(*) FROM pagamentos WHERE created_at > '<hora_inicio_cutover>';
```

- [ ] Se houver dados: migrar manualmente para o antigo antes de notificar usuários
- [ ] Se não houver dados novos significativos: rollback completo sem necessidade de reconciliação

---

## O que NÃO fazer durante o rollback

- Não apagar dados do Supabase novo — podem ser necessários para reconciliação
- Não alterar secrets do Supabase antigo — ele deve estar intacto
- Não fazer deploy de código novo no antigo enquanto o rollback não estiver confirmado
- Não comunicar usuários como "problema resolvido" antes de confirmar que o antigo voltou 100%

---

## Pós-rollback

1. Documentar no `MIGRATION_STATUS.md`: causa raiz do problema
2. Abrir issue no GitHub com label `migration-blocker`
3. Reagendar próxima tentativa somente após resolver o bloqueador
4. Não tentar novo cutover sem corrigir o que falhou
