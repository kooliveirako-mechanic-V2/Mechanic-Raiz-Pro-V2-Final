CREATE OR REPLACE FUNCTION public.criar_orcamento_completo(
  p_oficina_id uuid,
  p_titulo text,
  p_cliente_id uuid DEFAULT NULL::uuid,
  p_veiculo_id uuid DEFAULT NULL::uuid,
  p_descricao text DEFAULT NULL::text,
  p_validade text DEFAULT NULL::text,
  p_desconto numeric DEFAULT 0,
  p_observacoes text DEFAULT NULL::text,
  p_itens jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_orcamento_id UUID;
  v_numero INTEGER;
  v_item JSONB;
  v_total NUMERIC := 0;
  v_custo_total NUMERIC := 0;
  v_itens_count INTEGER := 0;
  v_qty NUMERIC;
  v_unit_price NUMERIC;
  v_mao_obra NUMERIC;
  v_custo NUMERIC;
  v_item_total NUMERIC;
BEGIN
  -- ETAPA 1: Criar cabeçalho do orçamento
  INSERT INTO orcamentos (
    oficina_id, cliente_id, veiculo_id,
    titulo, descricao, status,
    validade, desconto, observacoes,
    valor_total, custo_total
  ) VALUES (
    p_oficina_id, p_cliente_id, p_veiculo_id,
    p_titulo, p_descricao, 'rascunho',
    CASE WHEN p_validade IS NOT NULL AND p_validade <> '' THEN p_validade::date ELSE NULL END,
    COALESCE(p_desconto, 0), p_observacoes,
    0, 0
  )
  RETURNING id, numero INTO v_orcamento_id, v_numero;

  -- ETAPA 2: Inserir itens (valor_total é GENERATED ALWAYS — não inserir)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_itens)
  LOOP
    v_qty := GREATEST(COALESCE((v_item->>'quantidade')::NUMERIC, 1), 1);
    v_unit_price := COALESCE((v_item->>'valor_unitario')::NUMERIC, 0);
    v_mao_obra := COALESCE((v_item->>'valor_mao_obra')::NUMERIC, 0);
    v_custo := COALESCE((v_item->>'custo_unitario')::NUMERIC, 0);
    v_item_total := (v_qty * v_unit_price) + v_mao_obra;

    INSERT INTO itens_orcamento (
      orcamento_id, nome_item, tipo,
      quantidade, valor_unitario, valor_mao_obra,
      custo_unitario, estoque_id
    ) VALUES (
      v_orcamento_id,
      v_item->>'nome_item',
      COALESCE(v_item->>'tipo', 'produto'),
      v_qty, v_unit_price, v_mao_obra,
      v_custo,
      NULLIF(v_item->>'estoque_id', '')::UUID
    );

    v_total := v_total + v_item_total;
    v_custo_total := v_custo_total + (v_custo * v_qty);
    v_itens_count := v_itens_count + 1;
  END LOOP;

  -- ETAPA 3: Atualizar totais reais
  UPDATE orcamentos
  SET valor_total = v_total,
      custo_total = v_custo_total
  WHERE id = v_orcamento_id;

  RETURN jsonb_build_object(
    'id', v_orcamento_id,
    'numero', v_numero,
    'valor_total', v_total,
    'itens_inseridos', v_itens_count
  );
END;
$function$;