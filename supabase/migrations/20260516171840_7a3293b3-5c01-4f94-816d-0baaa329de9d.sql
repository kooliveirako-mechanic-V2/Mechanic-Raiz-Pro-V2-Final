-- 1) Adiciona colunas de arquivamento
ALTER TABLE public.estoque
  ADD COLUMN IF NOT EXISTS arquivado BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS arquivado_em TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_estoque_oficina_arquivado
  ON public.estoque (oficina_id, arquivado);

-- 2) Reescreve a RPC para suportar soft delete
CREATE OR REPLACE FUNCTION public.atomic_delete_estoque(
  p_estoque_id uuid,
  p_oficina_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_nome TEXT;
  v_tem_vinculo BOOLEAN;
BEGIN
  -- Verifica se o item pertence à oficina
  SELECT nome INTO v_nome
  FROM estoque
  WHERE id = p_estoque_id
    AND oficina_id = p_oficina_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item não encontrado ou sem permissão';
  END IF;

  -- Verifica se há QUALQUER vínculo (OS ou orçamento, em qualquer status)
  SELECT
    EXISTS(SELECT 1 FROM itens_os WHERE estoque_id = p_estoque_id)
    OR
    EXISTS(SELECT 1 FROM itens_orcamento WHERE estoque_id = p_estoque_id)
  INTO v_tem_vinculo;

  IF v_tem_vinculo THEN
    -- SOFT DELETE: arquiva preservando histórico
    UPDATE estoque
    SET arquivado = true,
        arquivado_em = now(),
        quantidade = 0,
        updated_at = now()
    WHERE id = p_estoque_id
      AND oficina_id = p_oficina_id;

    RETURN jsonb_build_object(
      'success', true,
      'nome', v_nome,
      'soft_delete', true,
      'message', 'Item arquivado (histórico preservado nas OS antigas)'
    );
  END IF;

  -- HARD DELETE: nunca foi usado, pode apagar de verdade
  DELETE FROM estoque_movimentacoes
  WHERE estoque_id = p_estoque_id;

  DELETE FROM estoque
  WHERE id = p_estoque_id
    AND oficina_id = p_oficina_id;

  RETURN jsonb_build_object(
    'success', true,
    'nome', v_nome,
    'soft_delete', false,
    'message', 'Item e histórico removidos com sucesso'
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Erro ao excluir item do estoque: %. Nenhuma alteração foi salva.', SQLERRM;
END;
$function$;