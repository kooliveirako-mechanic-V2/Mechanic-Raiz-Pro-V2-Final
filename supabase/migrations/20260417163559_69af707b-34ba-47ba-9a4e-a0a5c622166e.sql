-- RPC para a edge function ingest-legacy-data executar upsert sem disparar triggers
-- (rate_limit, generated columns, etc.) — usado APENAS para migração de dados legados.
-- Segurança: SECURITY DEFINER + restrita a service_role via REVOKE.

CREATE OR REPLACE FUNCTION public.ingest_upsert_bypass_triggers(
  p_table text,
  p_rows jsonb,
  p_conflict_column text DEFAULT 'id'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed_tables text[] := ARRAY[
    'profiles','oficinas','oficina_configuracoes','user_roles','subscriptions',
    'clientes','veiculos','ordens_servico','itens_os','orcamentos','itens_orcamento',
    'financeiro','estoque','estoque_movimentacoes','parcelas_pagamento',
    'categorias_financeiras','centros_custo','formas_pagamento','fornecedores',
    'comissoes_funcionarios','recorrencias','notificacoes','user_migration_map'
  ];
  v_columns text;
  v_update_set text;
  v_sql text;
  v_count int;
BEGIN
  IF NOT (p_table = ANY(v_allowed_tables)) THEN
    RAISE EXCEPTION 'Tabela % não permitida', p_table;
  END IF;

  -- Desabilita TODOS os triggers da sessão (inclui rate_limit, audit, etc.)
  -- Atomicamente reverte ao final da transação.
  PERFORM set_config('session_replication_role', 'replica', true);

  -- Pega as colunas do primeiro objeto JSON pra montar o INSERT dinâmico
  SELECT string_agg(quote_ident(key), ', ')
    INTO v_columns
  FROM jsonb_object_keys(p_rows->0) as key;

  -- Monta SET para UPDATE (excluindo a coluna de conflito)
  SELECT string_agg(
    quote_ident(key) || ' = EXCLUDED.' || quote_ident(key), ', '
  ) INTO v_update_set
  FROM jsonb_object_keys(p_rows->0) as key
  WHERE key <> p_conflict_column;

  v_sql := format(
    'INSERT INTO public.%I (%s) SELECT %s FROM jsonb_populate_recordset(NULL::public.%I, $1) ON CONFLICT (%I) DO UPDATE SET %s',
    p_table, v_columns, v_columns, p_table, p_conflict_column, v_update_set
  );

  EXECUTE v_sql USING p_rows;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'table', p_table, 'affected', v_count);
END;
$$;

-- Bloqueia uso por usuários autenticados; só service_role pode chamar
REVOKE ALL ON FUNCTION public.ingest_upsert_bypass_triggers(text, jsonb, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ingest_upsert_bypass_triggers(text, jsonb, text) FROM authenticated;
REVOKE ALL ON FUNCTION public.ingest_upsert_bypass_triggers(text, jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.ingest_upsert_bypass_triggers(text, jsonb, text) TO service_role;