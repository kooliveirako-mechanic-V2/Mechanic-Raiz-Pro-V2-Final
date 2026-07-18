# Plano de teste controlado — on_auth_user_created
**Data:** 2026-07-18  
**Branch:** migration/supabase-cutover-prep  
**Status:** AGUARDANDO AUTORIZAÇÃO DE EXECUÇÃO

---

## Objetivo

Validar que o trigger `on_auth_user_created` + função `handle_new_user()` funcionam corretamente no projeto novo antes de qualquer usuário real fazer login.

---

## Análise de risco do trigger

A função `handle_new_user()` tem o seguinte comportamento:

```sql
INSERT INTO public.profiles (user_id, nome)
VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email))
ON CONFLICT (user_id) DO NOTHING;
RETURN NEW;
```

**Cenários que NÃO bloqueiam o signup:**
- Profile já existe com esse `user_id` → `DO NOTHING`, continua
- `raw_user_meta_data` ausente → fallback para `NEW.email`

**Cenários que PODEM bloquear o signup:**
- `NEW.email` é NULL e `raw_user_meta_data` não tem `nome` → `profiles.nome` é NOT NULL, INSERT falha com constraint violation → exceção não tratada → signup bloqueado
- Permissão negada em `public.profiles` para o role que executa a função → INSERT falha → signup bloqueado
- `public.profiles` indisponível (lock, manutenção) → INSERT falha → signup bloqueado

**Owner e permissões confirmadas:**
- Owner: `postgres`
- EXECUTE grant: `postgres`, `PUBLIC`
- SECURITY DEFINER: sim — executa como `postgres`, bypassa RLS

**Risco do email NULL:**
No Supabase, o signup por email sempre fornece `NEW.email`. OAuth (Google) pode em casos raros retornar email vazio, mas isso é excepcional. O risco real é baixo, mas real.

**Nota sobre EXCEPTION WHEN OTHERS:**
Não adicionado intencionalmente — tratamento genérico de exceção criaria usuários sem profile silenciosamente, o que é pior do que um signup bloqueado visível.

---

## SQL de rollback do trigger

Se necessário remover o trigger:

```sql
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
```

Verificar remoção:
```sql
SELECT tgname FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE t.tgname = 'on_auth_user_created'
  AND n.nspname = 'auth' AND c.relname = 'users';
-- Esperado: 0 linhas
```

---

## Roteiro de teste controlado

**Pré-requisito:** executar somente em ambiente de homologação (projeto novo), nunca em produção.

### Etapa 1 — Criar usuário de teste

```sql
-- Verificar estado antes
SELECT count(*) FROM profiles;

-- Criar via Supabase Auth Admin API (não SQL direto):
-- POST /auth/v1/admin/users
-- { "email": "kira-test-trigger@kira.invalid", "password": "TestPassword123!", "email_confirm": true }
```

### Etapa 2 — Confirmar criação de profile

```sql
SELECT
  u.id AS auth_user_id,
  u.email,
  p.id AS profile_id,
  p.user_id,
  p.nome,
  p.created_at
FROM auth.users u
LEFT JOIN profiles p ON p.user_id = u.id
WHERE u.email = 'kira-test-trigger@kira.invalid';
-- Esperado: profile criado com user_id = auth.users.id e nome = email
```

### Etapa 3 — Testar sem metadata

Criar segundo usuário sem `raw_user_meta_data`:
```
{ "email": "kira-test-trigger2@kira.invalid", "password": "TestPassword123!", "email_confirm": true }
```
Verificar: `nome` deve ser o email, não NULL.

### Etapa 4 — Limpar

```sql
-- Deletar via Admin API (preserva integridade)
-- DELETE /auth/v1/admin/users/{uuid}

-- Verificar limpeza
SELECT count(*) FROM profiles WHERE nome LIKE '%kira-test-trigger%';
-- Esperado: 0 (o trigger não cria FK para profiles — delete do usuário não cascata automaticamente)
-- Se necessário: DELETE FROM profiles WHERE nome LIKE '%kira-test-trigger%';
```

---

## Critérios de aprovação

- [ ] Profile criado automaticamente com `user_id` correto
- [ ] `nome` preenchido (email como fallback)
- [ ] Sem erros nos logs do Supabase durante o signup
- [ ] Usuário e profile de teste removidos completamente
- [ ] Nenhum efeito colateral em outros profiles

---

## Gate

Não realizar backfill dos 34 usuários existentes antes de:
1. Este teste ser executado e aprovado
2. Estratégia de backfill definida (nome a usar, metadata disponível)
3. Autorização explícita

---

## Estado atual

- Trigger: INSTALADO
- Função: AUDITADA
- Teste: ROTEIRO PRONTO — aguardando autorização para execução
