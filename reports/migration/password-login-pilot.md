# Piloto de Login por Email e Senha — Supabase Novo
**Projeto novo:** `kurlgmngmglhvknwxjee`
**Branch:** `migration/remove-lovable-auth`
**Data:** 2026-07-18
**Escopo:** auditoria somente leitura; nenhuma conta, senha, identity ou recovery foi alterada.

---

## Estratégia aprovada

PASSWORD_LOGIN_PILOT=APROVADO
MASS_PASSWORD_RESET=NÃO_RECOMENDADO

- Preservar os 35 usuários existentes.
- Login normal primeiro, usando a senha antiga.
- Google OAuth segue disponível quando a identity for vinculada pelo login do mesmo email verificado.
- Recovery individual somente para usuários que realmente falharem.
- Não criar identities manualmente nem executar reset em massa.

---

## Conta aprovada

| Campo | Valor |
|-------|-------|
| Email | `ko.oliveira.ko@gmail.com` |
| UUID | `702f8b8b-7ecb-428c-be39-bbbc392a16c8` |
| Password hash | Presente, bcrypt, 60 caracteres |
| Email confirmado | Sim (`2026-04-07 03:09:06+00`) |
| Providers declarados | `email`, `google` |
| Usuário duplicado | Não (`count = 1`) |
| Oficina vinculada | `KAIQUE'SCINAS` (`318e77c8-e7b3-46bc-8d02-bcea078df79e`) |
| Acesso à oficina | Aprovado no piloto visual informado |

`auth.identities` não contém linha para essa conta. Isto não invalidou o login por senha: o provider está declarado em `raw_app_meta_data.providers` e o hash bcrypt autenticou com sucesso. Há uma única identity Google no projeto, criada no piloto OAuth separado.

---

## Conta com falha isolada

| Campo | Valor |
|-------|-------|
| Email | `storekatendimento@gmail.com` |
| UUID | `6f6dd02a-59a5-481e-be88-933cc9b5f5fb` |
| Conta existe | Sim (`count = 1`) |
| Password hash | Presente, bcrypt, 60 caracteres |
| Email confirmado | Sim (`2026-04-17 18:09:36+00`) |
| Provider declarado | `email` |
| `auth.identities` | Nenhuma linha |
| Último login registrado | `2026-04-17 18:12:04+00` |
| Oficina vinculada | `[TESTE-MIGRACAO] Cobaia Auditoria` (`d72f2f1a-7a61-46e0-8520-2e00491ecd84`) |
| Metadata | `migrated=true`, `migrated_at=2026-04-17T18:09:36.566Z` |

### Hipótese técnica mais provável

A conta não é somente-Google: ela declara provider `email`, possui email confirmado e hash bcrypt com formato e tamanho idênticos ao da conta aprovada. O erro `Invalid login credentials` é genérico e não permite distinguir uma senha digitada incorretamente de um hash importado que não corresponda à senha esperada. A falha isolada não é evidência para reset em massa.

Sem alterar a conta, não é possível verificar uma senha candidata nem provar qual das duas hipóteses ocorreu. Se a falha persistir em nova tentativa consciente da senha, enviar recovery individual para esse usuário.

---

## Não realizados

- Nenhum recovery gerado.
- Nenhuma senha alterada.
- Nenhum email atualizado.
- Nenhuma identity criada manualmente.
- Nenhum usuário excluído ou recriado.
- Nenhum outro usuário testado.
