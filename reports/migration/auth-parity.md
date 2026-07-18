# Auth Parity Report — Supabase Novo
**Data:** 2026-07-18  
**Projeto novo:** kurlgmngmglhvknwxjee  
**Status:** BLOQUEANTE — Auth desconectado do banco de dados de negócio

---

## Resumo Executivo

A auditoria real do banco novo revelou um problema estrutural crítico:
**os 35 `auth.users` presentes no projeto novo não correspondem aos 113 `profiles` do schema `public`**.

Isso significa que nenhum usuário real consegue logar no projeto novo hoje. Os dados de negócio (oficinas, clientes, OS, financeiro) estão vinculados a UUIDs de usuários que não existem no `auth` do projeto novo.

---

## Resultados da Auditoria Real (executada em 2026-07-18)

| Métrica | Valor | Status |
|---------|-------|--------|
| `auth.users` total | 35 | — |
| `auth.users` com `encrypted_password` | 33 | — |
| `auth.users` sem `encrypted_password` | 2 | — |
| `auth.identities` total | **0** | 🔴 CRÍTICO |
| `auth.identities` Google | **0** | 🔴 CRÍTICO |
| `profiles` total | 113 | — |
| `profiles` com `auth.user` correspondente (via `user_id`) | **1** | 🔴 CRÍTICO |
| `auth.users` com `profile` correspondente | **1/35** | 🔴 CRÍTICO |
| `profiles` órfãos (sem `auth.user`) | **112/113** | 🔴 CRÍTICO |

---

## Causa Raiz

O restore separou os dois schemas de fontes incompatíveis:

- **`public.*`** — veio do backup completo do banco antigo (`cuhkkoqqeguascdsvtky`), com 113 usuários reais, seus dados de oficinas, OS, financeiro, etc.
- **`auth.users`** — os 35 registros existentes no projeto novo são de uma fonte diferente. Provavelmente criados manualmente ou de um restore parcial anterior não relacionado ao backup de produção.

O único match (`user_id = 27446840-204b-4128-ad2d-3e25460e77fa`, email `mia150vinho@gmail.com`) é coincidência — esse UUID existe em ambos.

---

## Impacto Direto

1. **Login quebrado para 112/113 usuários reais** — o `auth.users` não tem os UUIDs que o `profiles`, `user_roles`, `oficinas` e todo o resto do banco esperam.

2. **Login Google quebrado para TODOS** — `auth.identities` está vazio. Mesmo se o UUID batesse, OAuth não funcionaria.

3. **Dados de negócio intactos** — as 172 oficinas, 395 OS, 347 clientes, 472 registros financeiros estão todos presentes e com integridade interna. O problema é exclusivamente no schema `auth`.

---

## Providers dos auth.users Existentes (os 35 "errados")

| Provider | Quantidade | Com senha |
|----------|-----------|-----------|
| `email` | 33 | 33 |
| `google` | 2 | 0 (OAuth, sem senha) |

---

## Solução Necessária

O schema `auth` do projeto novo precisa ser substituído pelos dados reais do banco antigo.

O Supabase documenta este processo em:
https://supabase.com/docs/guides/troubleshooting/migrating-auth-users-between-projects

**O que precisa vir do banco antigo:**
- `auth.users` completo (com `encrypted_password`, `email_confirmed_at`, `raw_app_meta_data`, `raw_user_meta_data`)
- `auth.identities` completo (vínculos OAuth Google)
- Preservação dos UUIDs exatos

**Quem pode fornecer:** A Lovable tem acesso ao `pg_dump` completo incluindo o schema `auth`. O Export Data padrão cobre só `public`.

---

## Cenários de Remediação

### Cenário A — Restore de auth via pg_dump (preferido)
A Lovable exporta `auth.users` e `auth.identities` via `pg_dump --schema=auth`. Você importa no projeto novo com TRUNCATE + INSERT preservando UUIDs. Nenhum usuário precisa resetar senha.

### Cenário B — Export via Admin API + reset de senha
Usar `auth.admin.listUsers()` para exportar UUIDs e emails, criar usuários no novo preservando UUIDs, disparar reset de senha em massa para quem usava email/senha. Usuários Google precisam de `auth.identities` recriadas manualmente.

### Cenário C — Manter auth.users do antigo via restore completo
Usar `pg_restore` com `--schema=auth` no arquivo `.backup` que já existe localmente em `Downloads/mechanicraizpro_260716.backup`.

---

## Próxima Ação Recomendada

**Antes de qualquer outra coisa:** verificar se o `.backup` local contém dados de `auth.users`. Se contiver, o problema pode ser resolvido com um restore incremental do schema `auth` no projeto novo, sem precisar da Lovable.

```bash
# Verificar conteúdo do backup sem restaurar
pg_restore --list "/c/Users/Hp/Downloads/mechanicraizpro_260716.backup" | grep -i "auth"
```

Se o backup contiver `auth`, o Cenário C é a solução mais rápida e segura.

---

## GATE Auth

Nenhuma tentativa de cutover antes de:
- [ ] `auth.users` do banco antigo importados no projeto novo (preservando UUIDs)
- [ ] `auth.identities` do banco antigo importados (links Google)
- [ ] Pelo menos 1 usuário real consegue logar no projeto novo (teste piloto)
- [ ] `auth.identities` não está mais zerado
