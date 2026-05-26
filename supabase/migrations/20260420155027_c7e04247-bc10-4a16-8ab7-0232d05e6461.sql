-- ============================================================================
-- ETAPA 3 — IMPORTAÇÃO ATÔMICA DE CLIENTES EM LOTE
-- ============================================================================
-- Cria RPC que importa N clientes em uma única transação (tudo ou nada),
-- com deduplicação por telefone normalizado e rastreabilidade por loteId.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.importar_clientes_lote(
  p_oficina_id uuid,
  p_lote_id text,
  p_clientes jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cliente jsonb;
  v_telefone_norm text;
  v_telefone_sufixo text;
  v_existing_id uuid;
  v_new_id uuid;
  v_criados integer := 0;
  v_duplicados integer := 0;
  v_falhas integer := 0;
  v_total integer;
  v_ids_criados uuid[] := ARRAY[]::uuid[];
  v_erros jsonb := '[]'::jsonb;
  v_idx integer := 0;
BEGIN
  -- ─── 1) Validar permissão ──────────────────────────────────────────────
  IF NOT has_oficina_access(auth.uid(), p_oficina_id) THEN
    RAISE EXCEPTION 'Sem permissão para importar nesta oficina';
  END IF;

  -- ─── 2) Validar entrada ────────────────────────────────────────────────
  IF p_clientes IS NULL OR jsonb_typeof(p_clientes) <> 'array' THEN
    RAISE EXCEPTION 'Lista de clientes inválida';
  END IF;

  v_total := jsonb_array_length(p_clientes);

  IF v_total = 0 THEN
    RETURN jsonb_build_object(
      'success', true,
      'lote_id', p_lote_id,
      'total', 0,
      'criados', 0,
      'duplicados', 0,
      'falhas', 0,
      'ids_criados', '[]'::jsonb
    );
  END IF;

  IF v_total > 500 THEN
    RAISE EXCEPTION 'Limite máximo: 500 clientes por importação (recebido: %)', v_total;
  END IF;

  -- ─── 3) Loop atômico — toda a transação roda dentro de 1 BEGIN ────────
  FOR v_cliente IN SELECT * FROM jsonb_array_elements(p_clientes)
  LOOP
    v_idx := v_idx + 1;

    BEGIN
      -- Validar nome obrigatório
      IF COALESCE(NULLIF(TRIM(v_cliente->>'nome'), ''), NULL) IS NULL THEN
        v_falhas := v_falhas + 1;
        v_erros := v_erros || jsonb_build_object(
          'index', v_idx,
          'motivo', 'Nome obrigatório'
        );
        CONTINUE;
      END IF;

      -- Normalizar telefone (só dígitos, últimos 9 = sufixo de dedup)
      v_telefone_norm := regexp_replace(COALESCE(v_cliente->>'telefone', ''), '[^0-9]', '', 'g');
      v_telefone_sufixo := CASE
        WHEN length(v_telefone_norm) >= 9 THEN right(v_telefone_norm, 9)
        ELSE NULL
      END;

      -- Detectar duplicado por sufixo de telefone (mesma oficina)
      v_existing_id := NULL;
      IF v_telefone_sufixo IS NOT NULL THEN
        SELECT id INTO v_existing_id
        FROM clientes
        WHERE oficina_id = p_oficina_id
          AND telefone IS NOT NULL
          AND right(regexp_replace(telefone, '[^0-9]', '', 'g'), 9) = v_telefone_sufixo
        LIMIT 1;
      END IF;

      IF v_existing_id IS NOT NULL THEN
        v_duplicados := v_duplicados + 1;
        CONTINUE;
      END IF;

      -- Inserir cliente novo
      INSERT INTO clientes (
        oficina_id,
        nome,
        telefone,
        email,
        cpf_cnpj,
        endereco,
        observacoes
      ) VALUES (
        p_oficina_id,
        TRIM(v_cliente->>'nome'),
        NULLIF(TRIM(COALESCE(v_cliente->>'telefone', '')), ''),
        NULLIF(TRIM(COALESCE(v_cliente->>'email', '')), ''),
        NULLIF(TRIM(COALESCE(v_cliente->>'cpf_cnpj', '')), ''),
        NULLIF(TRIM(COALESCE(v_cliente->>'endereco', '')), ''),
        COALESCE(
          NULLIF(TRIM(COALESCE(v_cliente->>'observacoes', '')), ''),
          ''
        ) || CASE
          WHEN COALESCE(TRIM(v_cliente->>'observacoes'), '') = '' THEN ''
          ELSE ' | '
        END || 'Lote: ' || p_lote_id
      )
      RETURNING id INTO v_new_id;

      v_criados := v_criados + 1;
      v_ids_criados := array_append(v_ids_criados, v_new_id);

    EXCEPTION WHEN OTHERS THEN
      v_falhas := v_falhas + 1;
      v_erros := v_erros || jsonb_build_object(
        'index', v_idx,
        'motivo', SQLERRM
      );
    END;
  END LOOP;

  -- ─── 4) Retorno completo ─────────────────────────────────────────────
  RETURN jsonb_build_object(
    'success', true,
    'lote_id', p_lote_id,
    'total', v_total,
    'criados', v_criados,
    'duplicados', v_duplicados,
    'falhas', v_falhas,
    'ids_criados', to_jsonb(v_ids_criados),
    'erros', v_erros
  );
END;
$$;

-- Garantir que apenas authenticated pode chamar
REVOKE ALL ON FUNCTION public.importar_clientes_lote(uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.importar_clientes_lote(uuid, text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.importar_clientes_lote IS
'Importa lista de clientes em transação atômica (tudo ou nada). Deduplica por sufixo de telefone (9 dígitos). Limite: 500 clientes por chamada. Marca cada cliente com loteId nas observações para rastreabilidade.';