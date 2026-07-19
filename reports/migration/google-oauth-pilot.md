# Piloto Google OAuth — Supabase Novo
**Projeto novo:** `kurlgmngmglhvknwxjee`
**Branch:** `migration/remove-lovable-auth`
**Data:** 2026-07-18

---

## Resultado do piloto

GOOGLE_LOGIN=APROVADO
EXPECTED_UUID_MATCH=SIM
IDENTITY_CREATED=SIM
DUPLICATE_USER_CREATED=NÃO
OFFICE_LOADED=SIM
RLS_ACCESS=APROVADO
CROSS_TENANT_DATA_VISIBLE=NÃO
PROFILE_REQUIRED_FOR_LOGIN=NÃO

---

## Conta piloto

- Email: `ko.oliveira2016@gmail.com`
- UUID: `82879702-5e29-4d83-86a4-08a9f061a6a4`
- Oficina carregada: `Mecânica Demonstração` (`dc11cb4b-d68b-4ad9-b464-0b642a4b620f`)

---

## Confirmações pós-login

- Callback Google retornou para `http://127.0.0.1:8080`.
- Sessão criada no UUID existente, sem duplicar usuário.
- `auth.identities` criada com provider `google` no mesmo UUID.
- `raw_app_meta_data.providers = ["google"]`.
- `last_sign_in_at` atualizado.
- Tela "Conexão instável" desapareceu após reload da sessão já autenticada.
- Nenhuma repetição de OAuth foi necessária.
- Nenhuma alteração de dados foi realizada.

## Isolamento RLS validado

- UUID piloto sob role `authenticated` vê:
  - `oficinas`: 1 linha (a oficina própria)
  - `user_roles`: 1 linha (vínculo ativo)
  - `profiles`: 0 linhas (ausência tratada como fallback no código)
- UUID autenticado não relacionado vê 0 linhas em todas as três tabelas.
- Nenhuma informação de outra oficina ficou visível.

## Migrations associadas

| Migration | Função | Commit |
|-----------|--------|--------|
| `20260718194059_fix_tracking_anon_grants` | tracking anônimo via RPC + grants mínimos em `marketing_events` | `1e5bb86` |
| `20260718213000_authenticated_read_grants` | `GRANT SELECT` em `oficinas`, `user_roles`, `profiles` para `authenticated` | `83919df` |

## Rollback dos grants de leitura

```sql
REVOKE SELECT ON TABLE public.oficinas FROM authenticated;
REVOKE SELECT ON TABLE public.user_roles FROM authenticated;
REVOKE SELECT ON TABLE public.profiles FROM authenticated;
```

## Pendente (fora desta rodada)

- Grants de escrita (`INSERT` em `oficinas`, `UPDATE` em `profiles`) para onboarding/seleção de oficina — etapa separada.
- Teste de conta por e-mail/senha própria para verificar se demais usuários mantêm senha antiga ou precisam de recuperação.
