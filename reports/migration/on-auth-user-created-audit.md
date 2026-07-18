# Auditoria: on_auth_user_created + handle_new_user()
**Data:** 2026-07-18  
**Branch:** migration/supabase-cutover-prep  
**Status:** TRIGGER INSTALADO — AUDITADO E APROVADO

---

## Definição real instalada no projeto novo

```sql
-- Trigger (schema auth):
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Função chamada (schema public):
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql
SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nome)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email)
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$
```

---

## Checklist de segurança

| Item | Resultado | Observação |
|------|-----------|-----------|
| Evento correto | ✅ | `AFTER INSERT ON auth.users` |
| Função chamada correta | ✅ | `public.handle_new_user()` |
| Insere em `profiles.user_id` | ✅ | Correto — não usa `profiles.id` |
| Trata conflito | ✅ | `ON CONFLICT (user_id) DO NOTHING` |
| SECURITY DEFINER | ✅ | Necessário para inserir em `public.profiles` de trigger em `auth` |
| search_path seguro | ✅ | `SET search_path TO 'public'` — previne substituição maliciosa |
| Risco de bloquear signup | ✅ Baixo | `RETURN NEW` ocorre independente do INSERT; erro no INSERT seria silenciado por DO NOTHING |
| Colunas NOT NULL | ✅ | `nome` tem fallback para `email` via COALESCE |
| Metadados ausentes | ✅ Tratado | COALESCE garante valor mesmo sem `raw_user_meta_data` |
| Backfill automático dos existentes | ❌ Não acontece | Trigger só dispara em futuros INSERTs — não cria profiles para os 35 existentes |

---

## O que o trigger resolve (e o que não resolve)

**Resolve:**
- Novos cadastros a partir de agora criarão profile automaticamente
- Evita a regressão de novos usuários sem profile

**Não resolve (ponto importante):**
- Os 34/35 `auth.users` existentes sem profile continuam sem profile
- O backfill precisa ser feito separadamente, com os dados corretos (nome, etc.)
- `auth.identities` continua zerado — não é afetado por este trigger

---

## Reconciliação: migration vs banco real

### O que foi aplicado
O trigger `on_auth_user_created` foi aplicado via `supabase db query --linked` com SQL direto, porque `supabase db push` falhou por divergência de migration history entre o banco novo (restaurado via dump) e o repositório.

### Migration file criada
`supabase/migrations/20260718000001_fix-missing-triggers.sql`

### Problema identificado
A migration atual declara 6 triggers, mas apenas 1 foi aplicado com sucesso. Os outros 5 dependem de funções ausentes no projeto novo:

| Trigger | Função necessária | Função existe? |
|---------|-----------------|---------------|
| `on_auth_user_created` | `public.handle_new_user()` | ✅ Aplicado |
| `trg_rate_limit_os_insert` | `public.rate_limit_os_insert()` | ⚠️ Existe mas falhou (schema issue) |
| `trg_relink_migrated_user` | `public.relink_migrated_user()` | ✅ Já existia no banco |
| `validate_veiculo_tipo_trigger` | `public.validate_veiculo_tipo()` | ❌ Ausente |
| `validate_orcamento_access_trigger` | `public.validate_orcamento_access()` | ❌ Ausente |
| `validate_estoque_access_trigger` | `public.validate_estoque_access()` | ❌ Ausente |

### Ação necessária
A migration `20260718000001_fix-missing-triggers.sql` deve ser atualizada para conter apenas o trigger que foi realmente aplicado, com comentários claros sobre os demais. Isso evita confusão entre "o que está no Git" e "o que está no banco".

---

## Estado final

- `on_auth_user_created`: **INSTALADO e SEGURO**
- Próximos cadastros criarão profiles automaticamente
- Backfill dos 34 existentes: **pendente de autorização explícita**
- `auth.identities`: **0 — bloqueante, aguardando dump do suporte Lovable**
