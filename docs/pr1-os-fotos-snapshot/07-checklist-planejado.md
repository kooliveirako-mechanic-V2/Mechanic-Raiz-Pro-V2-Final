# PR 1 — Entregável 7/7: Checklist planejado (pós-execução)

Este é o **checklist planejado** para o momento em que houver autorização
literal de execução em produção (`🟢 autorizo executar o PR 1 em produção`).
Enquanto não houver essa autorização, o checklist permanece em estado
planejado e nada é rodado.

## Sequência prevista de execução

1. Aplicar migration com o conteúdo de `01-create-table.sql` via
   `supabase--migration` (criação de `public.os_fotos_snapshot_pr1` + GRANTs +
   ENABLE RLS + índices). Sem policies = sem acesso via PostgREST, conforme
   intenção (tabela só para auditoria via service_role).
2. Aplicar `02-insert-union.sql` (também via migration, mesma transação
   se possível) para popular o snapshot do run inicial.
3. Rodar as 3 queries de `03-queries-inventario.sql` e colar a saída literal
   no chat para validação contra `04-resultado-bruto-esperado.md`.

## Critérios de aceitação pós-execução

| # | Verificação | Critério |
|---|---|---|
| 1 | Query 3.1 retorna linhas | exatamente 3 |
| 2 | Query 3.1 — `os_id` distintos | 2 (`a15cdcd8…` e `7b3f4d04…`) |
| 3 | Query 3.2 | `requires_promotion=1`, `candidate_normalization=2` |
| 4 | Query 3.3 | `fotos_entrada=1`, `fotos_saida=2` |
| 5 | `SELECT count(*) FROM pg_policies WHERE tablename='os_fotos_snapshot_pr1'` | 0 |
| 6 | Estado de `ordens_servico` (linhas, `fotos_entrada`, `fotos_saida`) | inalterado vs snapshot pré-PR1 |
| 7 | Estado de `storage.objects` no bucket `os-fotos` | 0 linhas alteradas (`updated_at` anterior à execução) |
| 8 | Visibilidade pública do bucket `os-fotos` (flag `public`) | inalterada |
| 9 | `pg_proc.prosecdef` em funções tocadas pelo PR 1 | N/A (nenhuma função criada) |

Qualquer divergência → rollback via `05-rollback.sql` e auditoria de
incidente antes de nova tentativa.

## Fora de escopo (NÃO acontece no PR 1)

- Promoção de arquivos de `temp/` para `<os_id>/`.
- Normalização de URL pública → path relativo em `ordens_servico`.
- Privatização do bucket `os-fotos`.
- Criação/alteração de policies de Storage.
- Qualquer alteração de frontend, hooks, componentes, edge functions.
- Geração de signed URLs.

## Governança

- **Revisão técnica (🟡)** ≠ **autorização de execução (🟢)**.
- Execução só ocorre após mensagem literal: `🟢 autorizo executar o PR 1 em produção`.
- Pacote rejeitado se a prova negativa (entregável 6) tiver qualquer match.
