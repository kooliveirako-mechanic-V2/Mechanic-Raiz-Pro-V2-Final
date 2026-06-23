
-- Opção A: permitir exclusão de item em OS finalizada SOMENTE quando vier
-- via RPC deletar_item_os_atomic (que já restaura estoque atomicamente).
-- Demais caminhos continuam bloqueados pelo trigger de proteção.

CREATE OR REPLACE FUNCTION public.tg_proteger_itens_os_finalizada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_bypass text;
BEGIN
  -- Bypass controlado: a RPC deletar_item_os_atomic seta este GUC
  -- local antes do DELETE, garantindo que somente exclusões auditadas
  -- (com restauração de estoque) sejam permitidas em OS finalizadas.
  BEGIN
    v_bypass := current_setting('app.allow_finalized_item_delete', true);
  EXCEPTION WHEN OTHERS THEN
    v_bypass := NULL;
  END;

  IF TG_OP = 'DELETE' AND v_bypass = 'on' THEN
    RETURN OLD;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.ordens_servico
    WHERE id = COALESCE(NEW.ordem_servico_id, OLD.ordem_servico_id)
      AND status = 'finalizado'
  ) THEN
    RAISE EXCEPTION 'Não é possível alterar itens de uma Ordem de Serviço já finalizada. Reabra a OS primeiro.';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

-- Atualiza a RPC para setar o bypass local antes do DELETE.
CREATE OR REPLACE FUNCTION public.deletar_item_os_atomic(p_item_id uuid, p_oficina_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_os_id UUID;
  v_estoque_id UUID;
  v_quantidade INTEGER;
  v_os_status TEXT;
  v_nome_item TEXT;
  v_estoque_qtd_atual INTEGER;
BEGIN
  SELECT io.ordem_servico_id, io.estoque_id, io.quantidade, io.nome_item, os.status
  INTO v_os_id, v_estoque_id, v_quantidade, v_nome_item, v_os_status
  FROM itens_os io
  JOIN ordens_servico os ON os.id = io.ordem_servico_id
  WHERE io.id = p_item_id
  FOR UPDATE OF io;

  IF v_os_id IS NULL THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM ordens_servico WHERE id = v_os_id AND oficina_id = p_oficina_id) THEN
    RAISE EXCEPTION 'Sem permissão para esta OS';
  END IF;

  -- Restaura estoque se OS finalizada + item vinculado a estoque
  IF v_os_status = 'finalizado' AND v_estoque_id IS NOT NULL AND v_quantidade > 0 THEN
    SELECT quantidade INTO v_estoque_qtd_atual
    FROM estoque
    WHERE id = v_estoque_id
    FOR UPDATE;

    IF v_estoque_qtd_atual IS NOT NULL THEN
      UPDATE estoque
      SET quantidade = quantidade + v_quantidade
      WHERE id = v_estoque_id;

      INSERT INTO estoque_movimentacoes (
        estoque_id, oficina_id, tipo, quantidade,
        quantidade_anterior, quantidade_nova,
        motivo, referencia_tipo, referencia_id
      ) VALUES (
        v_estoque_id, p_oficina_id, 'entrada', v_quantidade,
        v_estoque_qtd_atual, v_estoque_qtd_atual + v_quantidade,
        'Devolvido ao estoque (item removido de OS finalizada)',
        'itens_os', p_item_id
      );
    END IF;
  END IF;

  -- Habilita bypass local APENAS para este DELETE nesta transação
  PERFORM set_config('app.allow_finalized_item_delete', 'on', true);

  DELETE FROM itens_os WHERE id = p_item_id;

  -- Limpa o flag
  PERFORM set_config('app.allow_finalized_item_delete', 'off', true);

  RETURN jsonb_build_object(
    'success', true,
    'nome_item', v_nome_item,
    'estoque_restaurado', (v_os_status = 'finalizado' AND v_estoque_id IS NOT NULL)
  );

EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Erro ao deletar item: %. Nenhum dado foi alterado.', SQLERRM;
END;
$function$;
