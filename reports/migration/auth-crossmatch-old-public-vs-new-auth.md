# Auth Crossmatch — Antigo (public) × Novo (auth)
**Data:** 2026-07-18  
**Fonte antigo:** public.oficinas.user_id (proxy dos UUIDs reais do banco antigo)  
**Fonte novo:** auth.users do projeto kurlgmngmglhvknwxjee

---

## Diagnóstico Revisado

O diagnóstico anterior estava incorreto. Os 35 `auth.users` do projeto novo **são os usuários reais de produção**, não usuários de outra fonte.

**O problema real:** os 113 `profiles` do restore vieram de um snapshot anterior onde esses 35 usuários ainda não tinham profiles criados, ou os profiles existentes usam `user_id` de uma versão anterior do banco que não bate com esses UUIDs.

---

## Resultados do Crossmatch

| Métrica | Valor |
|---------|-------|
| auth.users total no projeto novo | 35 |
| auth.users com UUID em oficinas.user_id | **32/35** |
| auth.users com profile correspondente | **1/35** |
| auth.users sem profile | **34/35** |
| auth.users Google OAuth (sem senha) | 3 |
| auth.users email/senha | 32 |
| auth.identities | **0** — bloqueante para Google login |

---

## Classificação dos 35 Usuários

### Categoria A — UUID correto, sem profile (32 usuários)
Têm UUID correspondente em `oficinas.user_id`. São usuários reais de produção. Estão sem profile por causa do snapshot desatualizado do `public`.

| Email | Provider | Tem Oficina | Tem Profile |
|-------|----------|-------------|-------------|
| ko.oliveira.ko@gmail.com | email | ✅ | ❌ |
| alexsandrogoes18@gmail.com | email | ❌ | ❌ |
| gregoireanani7@gmail.com | google | ✅ | ❌ |
| ko.oliveira2016@gmail.com | google | ✅ | ❌ |
| storekatendimento@gmail.com | email | ✅ | ❌ |
| alex-motos03@hotmail.com | email | ✅ | ❌ |
| dsmotos26@gmail.com | email | ✅ | ❌ |
| linonetolf1@gmail.com | email | ✅ | ❌ |
| alineliiy931@gmail.com | email | ✅ | ❌ |
| hany-el@hotmail.com | email | ✅ | ❌ |
| mecanicoluiz7402@gmail.com | email | ✅ | ❌ |
| edison3tentos@gmail.com | email | ✅ | ❌ |
| ita2712@gmail.com | email | ✅ | ❌ |
| flaviamanu1311@gmail.com | email | ✅ | ❌ |
| orafaelzinhobh@gmail.com | email | ✅ | ❌ |
| hartmanlima46@gmail.com | email | ✅ | ❌ |
| maremotos.ofc22@gmail.com | email | ✅ | ❌ |
| pulie@gmail.com | email | ✅ | ❌ |
| jvjufcmma@gmail.com | email | ✅ | ❌ |
| allisontav9@gmail.com | email | ✅ | ❌ |
| pedromaremotos@gmail.com | email | ✅ | ❌ |
| paullomoraes550@gmail.com | email | ✅ | ❌ |
| alanmotopecas97@gmail.com | email | ✅ | ❌ |
| brunobruna0603@gmail.com | email | ✅ | ❌ |
| rhmsaoficina@gmail.com | email | ✅ | ❌ |
| sergiodasdores534@gmail.com | email | ✅ | ❌ |
| officinamotos0877@gmail.com | email | ✅ | ❌ |
| alexmotos0309@gmail.com | email | ✅ | ❌ |
| neilsonbezerransb@gmail.com | email | ✅ | ❌ |
| wagnerfeliciojr5@gmail.com | email | ✅ | ❌ |
| royalguincho@hotmail.com | email | ✅ | ❌ |
| zerinhomotopecas@gmail.com | email | ✅ | ❌ |

### Categoria B — UUID correto, com profile (1 usuário)
| Email | Provider | Tem Oficina | Tem Profile |
|-------|----------|-------------|-------------|
| mia150vinho@gmail.com | email | ✅ | ✅ |

### Categoria C — Sem oficina, sem profile (2 usuários)
Possivelmente contas incompletas ou testes.
| Email | Provider | Observação |
|-------|----------|-----------|
| mecanicabarbosa01@gmail.com | email | Sem oficina vinculada |
| oilgarage36@gmail.com | google | Sem oficina, sem senha |

---

## Causa Raiz

O restore do `public` trouxe 113 profiles de um snapshot de data anterior ao registro desses 35 usuários. As duas fontes não se sobrepõem no tempo — os profiles existentes no banco novo são de usuários anteriores que não constam no `auth.users` atual.

---

## O Que É Bloqueante

1. **`auth.identities` zerado** — login Google quebrado para `gregoireanani7`, `ko.oliveira2016`, `oilgarage36`. Precisa de export de `auth.identities` do banco antigo.

2. **Profiles ausentes para 34/35 usuários** — sistema pode funcionar parcialmente (oficinas existem, dados existem), mas funcionalidades que dependem de `profiles` (nome, avatar, preferências) vão falhar. Necessita restore atualizado de `public.profiles` ou novo restore completo do `public` com snapshot mais recente.

---

## Recomendação

### Solução A (preferida) — Novo restore do public com snapshot recente
Solicitar à Lovable um novo export do `public` mais recente (não o backup de 16/07 que está em `Downloads`). O `auth.users` do projeto novo está correto — não precisa ser tocado. Só o `public` precisa ser atualizado.

### Solução B — Export seletivo de profiles + identities
Solicitar à Lovable apenas:
- `public.profiles` WHERE `user_id IN (lista dos 35 UUIDs)`
- `auth.identities` completo

Importar seletivamente sem fazer restore completo.

### O que NÃO fazer
- Não apagar os 35 `auth.users` — são os usuários reais de produção
- Não recriar auth.users via Admin API — eles já existem e estão corretos
- Não fazer reset de senha em massa — as senhas (encrypted_password) já estão preservadas

---

## GATE Auth Revisado

- [ ] Export de `public.profiles` para os 35 UUIDs reais (ou novo restore completo do public)
- [ ] Export de `auth.identities` para os 3 usuários Google
- [ ] Teste piloto: 1 usuário email/senha + 1 usuário Google
- [ ] `profiles` dos 35 usuários existem e têm `user_id` correto
