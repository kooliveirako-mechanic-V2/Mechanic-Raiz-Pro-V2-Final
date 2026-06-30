# PR 1 — Entregável 4/7: Resultado bruto esperado das 3 referências reais

Saída esperada da query 3.1 após o INSERT, formato `psql -A -F'|'` (sem
truncamento, com `os_id`, `oficina_id`, `valor_original` e `path_normalizado`
completos).

Validado por execução read-only do mesmo CASE/regex sobre a base de produção.
Os `oficina_id` abaixo serão preenchidos pela saída literal do `psql` na
execução autorizada (a coluna passou a fazer parte do snapshot na correção
round 2).

```
oficina_id|os_id|origem|posicao_array|valor_original|path_normalizado|tipo_valor|tipo_path|objeto_existe|status_sugerido
<oficina_id_real>|a15cdcd8-7d38-4e57-9d14-29d60ae82527|fotos_entrada|1|https://cuhkkoqqeguascdsvtky.supabase.co/storage/v1/object/public/os-fotos/temp/1777432404894-gktlbwm.jpg|temp/1777432404894-gktlbwm.jpg|url_publica_os_fotos|temp|t|requires_promotion
<oficina_id_real>|7b3f4d04-ab69-4350-8755-ddd0b4ed7dd3|fotos_saida|1|https://cuhkkoqqeguascdsvtky.supabase.co/storage/v1/object/public/os-fotos/7b3f4d04-ab69-4350-8755-ddd0b4ed7dd3/saida-1777076067161-pi2z78.jpg|7b3f4d04-ab69-4350-8755-ddd0b4ed7dd3/saida-1777076067161-pi2z78.jpg|url_publica_os_fotos|os_id|t|candidate_normalization
<oficina_id_real>|7b3f4d04-ab69-4350-8755-ddd0b4ed7dd3|fotos_saida|2|https://cuhkkoqqeguascdsvtky.supabase.co/storage/v1/object/public/os-fotos/7b3f4d04-ab69-4350-8755-ddd0b4ed7dd3/saida-1777076074296-k98d3.jpg|7b3f4d04-ab69-4350-8755-ddd0b4ed7dd3/saida-1777076074296-k98d3.jpg|url_publica_os_fotos|os_id|t|candidate_normalization
(3 rows)
```

Resumo esperado da query 3.2:

```
status_sugerido|total
candidate_normalization|2
requires_promotion|1
(2 rows)
```

Resumo esperado da query 3.3:

```
origem|total
fotos_entrada|1
fotos_saida|2
(2 rows)
```

Observação: `posicao_array` vem do `WITH ORDINALITY` do `unnest`. Os números
acima refletem a ordem atual dos arrays em produção — se um array tiver sido
reordenado entre o teste read-only e o INSERT real, a ordinalidade pode mudar,
mas a contagem total (3 linhas), os `os_id`, os `path_normalizado` e os
`status_sugerido` continuam sendo o critério de aceitação.
