# Validação de Dados Pós-Login — Conta Real
**Projeto novo:** `kurlgmngmglhvknwxjee`
**Branch:** `migration/remove-lovable-auth`
**Data:** 2026-07-18
**Escopo:** somente leitura; nenhuma alteração de dados, senha ou Auth.

---

## Conta validada

- UUID: `702f8b8b-7ecb-428c-be39-bbbc392a16c8`
- Oficina: `KAIQUE'SCINAS`
- Auth: aprovado previamente por login com senha e UUID preservado

## Migration aplicada para esta validação

- `20260718224500_authenticated_core_read_grants`
- Escopo exato:

```sql
GRANT SELECT ON TABLE public.clientes TO authenticated;
GRANT SELECT ON TABLE public.ordens_servico TO authenticated;
GRANT SELECT ON TABLE public.estoque TO authenticated;
GRANT SELECT ON TABLE public.veiculos TO authenticated;
```

Nenhum `INSERT`, `UPDATE`, `DELETE`, `GRANT ALL`, `ON ALL TABLES`, policy nova ou alteração de RLS foi aplicada.

## Policies confirmadas antes da aplicação

- `clientes_select` → `has_oficina_access(auth.uid(), oficina_id)`
- `os_select` → `has_oficina_access(auth.uid(), oficina_id)`
- `estoque_select` → `has_oficina_access(auth.uid(), oficina_id)`
- `veiculos_select` → `has_oficina_access(auth.uid(), oficina_id)`

## Resultado sob role `authenticated`

Com `request.jwt.claim.sub = '702f8b8b-7ecb-428c-be39-bbbc392a16c8'`:

- clientes: `8`
- veiculos: `9`
- ordens_servico: `14`
- estoque: `0`

Sem `42501`.

## Isolamento cross-tenant

Com UUID autenticado não relacionado (`11111111-1111-1111-1111-111111111111`):

- clientes: `0`
- veiculos: `0`
- ordens_servico: `0`
- estoque: `0`

Conclusão: grants mínimos destravaram leitura necessária e RLS continuou isolando por oficina.

## Rollback

```sql
REVOKE SELECT ON TABLE public.clientes FROM authenticated;
REVOKE SELECT ON TABLE public.ordens_servico FROM authenticated;
REVOKE SELECT ON TABLE public.estoque FROM authenticated;
REVOKE SELECT ON TABLE public.veiculos FROM authenticated;
```

## Próximo padrão

Repetir o mesmo processo apenas quando uma tela real provar necessidade: liberar `SELECT` mínimo por tabela, validar sob RLS, confirmar ausência de cross-tenant, e só então avançar para o próximo domínio (financeiro, agenda, peças, etc.).
