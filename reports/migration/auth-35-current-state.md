# Auth — Estado Atual dos 35 Usuários
**Data:** 2026-07-18  
**Projeto:** kurlgmngmglhvknwxjee  
**Fonte:** supabase db query --linked (somente leitura)

---

## Contagens (sem PII)

| Métrica | Valor |
|---------|-------|
| Total auth.users | 35 |
| Provider email | 32 |
| Provider Google | 3 |
| Com `encrypted_password` | 33 |
| Sem `encrypted_password` (OAuth puro) | 2 |
| Email confirmado | 35 |
| Já fizeram login | 34 |
| Nunca fizeram login | 1 |
| Com identity em `auth.identities` | **0 — BLOQUEANTE** |

---

## Análise por provider

**32 usuários email/senha:**
- 33 têm `encrypted_password` presente
- 1 usuário tem `provider = google` mas também tem `encrypted_password` (usuário que adicionou senha após OAuth)
- Todos os 35 têm `email_confirmed_at` preenchido
- 34 já fizeram pelo menos um login (`last_sign_in_at` não nulo)
- 1 nunca fez login — provável conta criada mas não ativada

**3 usuários Google OAuth:**
- 2 sem `encrypted_password` (dependem 100% de identity Google para logar)
- 1 com `encrypted_password` (pode logar via senha enquanto identity não for restaurada)
- Todos os 3 estão bloqueados para login Google enquanto `auth.identities = 0`

---

## Estado de auth.identities

```
auth.identities: 0 registros
```

Impacto:
- Login Google: **bloqueado** para os 3 usuários com provider Google
- Login email/senha: **provavelmente funcional** para os 32 com `encrypted_password`, mas comportamento completo do Supabase Auth com `identities = 0` requer teste piloto para confirmar

---

## Pendências

| Item | Status |
|------|--------|
| Piloto createUser descartável | A EXECUTAR |
| Piloto updateUserById (cria identity?) | A TESTAR no piloto |
| Piloto Google OAuth | BLOQUEADO — aguarda Client ID/Secret no projeto novo |
| Recovery dos 35 usuários reais | NÃO EXECUTAR até piloto aprovado |
| Backfill de profiles | NÃO EXECUTAR até cruzamento com Lovable |
