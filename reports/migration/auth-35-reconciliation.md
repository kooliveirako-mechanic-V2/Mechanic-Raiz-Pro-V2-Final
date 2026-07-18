# Auth 35 — Reconciliação e Matriz
**Data:** 2026-07-18  
**Branch:** migration/supabase-cutover-prep

---

## Reconciliação 32 vs 33

A inconsistência vinha de dois queries diferentes:

- **Query de oficinas:** `JOIN oficinas ON oficinas.user_id = u.id` — retornou **32** porque 1 dos 35 aparece na tabela `user_migration_map.new_user_id` mas não em `oficinas.user_id`.
- **Crossmatch Node.js:** varreu o mapa V2 por UUID em qualquer tabela — retornou **33** (3 Cat A + 30 Cat C) porque inclui entradas de `user_migration_map`.

**Número correto por fonte:**

| Fonte | UUIDs encontrados |
|-------|------------------|
| `oficinas.user_id` | **32** |
| `profiles.user_id` | **1** |
| Ambos (profile + oficina) | **1** |
| Somente oficina | **31** |
| Somente profile | **0** |
| Nenhum dos dois | **3** |
| `user_migration_map.new_user_id` | **3** |
| `user_migration_map.old_user_id` | **0** |

**Os 3 sem profile nem oficina:**
- Aparecem em `user_migration_map.new_user_id` (são os pares `old→new`)
- São usuários que foram remapeados — existem como destino de migração, não como donos de oficina ativa

---

## Contagens da Matriz dos 35

| Pergunta | Resposta |
|----------|---------|
| Precisam de profile no novo | **34** |
| Já têm profile correto | **1** |
| Têm oficina vinculada | **32** |
| Sem estrutura pública (nem profile, nem oficina) | **3** (pares de migração) |
| Provider email | **32** |
| Provider Google | **3** |
| Com `encrypted_password` | **33** (32 email + 1 Google com senha) |
| Sem `encrypted_password` | **2** (2 Google OAuth puros) |
| Com identity em `auth.identities` | **0** — BLOQUEANTE |

---

## Os 2 Usuários Categoria D

Categoria D = UUID não encontrado em nenhuma referência do mapa público V2.

| UUID (8 chars) | Provider | Tem oficina | Observação |
|----------------|----------|-------------|-----------|
| `1cdc3146` | email | Não | Cadastro posterior à data do backup; aparece apenas em `auth.users` |
| `a3caf4da` | google | Não | Cadastro posterior; Google OAuth sem senha — depende de `auth.identities` |

Ambos são cadastros recentes (criados após 2026-07-15, data do backup) sem oficina nem profile. Não são testes — são usuários reais que se cadastraram durante o período entre o backup e agora.

---

## Estado de auth.identities

| Verificação | Resultado |
|------------|-----------|
| `auth.identities` total | **0** — zerado |
| Identities esperadas para 32 usuários email | **32** (uma por usuário) |
| Identities esperadas para 3 usuários Google | **3** (uma por usuário) |
| Identities existentes | **0** |
| Inconsistência total | **35 identities faltando** |

**Impacto por provider:**
- Email/senha: login pode funcionar parcialmente (bcrypt disponível), mas `auth.identities` vazio é sinal de restore incompleto e pode causar falhas em fluxos de `signIn` que verificam identities.
- Google OAuth: login completamente quebrado para `gregoireanani7`, `ko.oliveira2016`, `oilgarage36` (e os 2 Cat D se vierem via Google).

---

## Plano de Preservação dos 35 Usuários

Quando o dump de `auth` da Lovable chegar:

1. **NÃO fazer TRUNCATE + INSERT cego** — isso apagaria os 35 atuais.
2. **Estratégia de merge:**
   - Para UUIDs que existem nos 35 E no dump: verificar se email e `encrypted_password` coincidem. Se sim, manter o atual e importar apenas as `identities` faltantes.
   - Para UUIDs no dump que NÃO estão nos 35: INSERT seguro (são usuários adicionais do antigo).
   - Para os 2 Cat D (criados após o backup): preservar incondicionalmente — não existirão no dump.
3. **`auth.identities`:** importar todas do dump, sem conflito (tabela está vazia).

---

## GATE Auth (revisado)

- [ ] Dump de `auth.users` + `auth.identities` do banco antigo (pedido ao suporte da Lovable)
- [ ] Novo snapshot de `public` atualizado (aguardando Lovable gerar)
- [ ] Merge de `auth.identities` no projeto novo (após receber dump)
- [ ] Teste piloto: 1 usuário email/senha + 1 usuário Google
- [ ] Os 2 Cat D preservados (não estão no dump antigo)
