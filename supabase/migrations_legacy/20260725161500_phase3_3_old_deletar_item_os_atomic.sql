-- LEGACY HOTFIX — Aplicado na produção viva.
-- Target project: cuhkkoqqeguascdsvtky (banco antigo, NÃO é o projeto linkado deste repo).
-- Data/hora UTC: 2026-07-25 16:15.
-- Pre-patch MD5: df8dcffab1bde2245acccdc040d9850c (2282 bytes)
-- Post-patch MD5: 1d0b5ae8051f699285361bb579ccac4c (2703 bytes)
-- A alteração substitui o guard cosmético (que confiava em p_oficina_id) por v_oficina_real
-- resolvido diretamente do JOIN com ordens_servico.
-- Assinatura (p_item_id uuid, p_oficina_id uuid) e retorno jsonb preservados.
-- Este arquivo é registro de rastreabilidade; não é aplicado via `supabase db push` neste repo.

BEGIN;

CREATE OR REPLACE FUNCTION public.deletar_item_os_atomic(p_item_id uuid, p_oficina_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, pg_temp
AS $function$
DECLARE
  v_os_id UUID;
  v_estoque_id UUID;
  v_quantidade INTEGER;
  v_os_status TEXT;
  v_nome_item TEXT;
  v_estoque_qtd_atual INTEGER;
  v_oficina_real UUID;
BEGIN
  SELECT io.ordem_servico_id, io.estoque_id, io.quantidade, io.nome_item, os.status
  INTO v_os_id, v_estoque_id, v_quantidade, v_nome_item, v_os_status
  FROM public.itens_os io
  JOIN public.ordens_servico os ON os.id = io.ordem_servico_id
  WHERE io.id = p_item_id
  FOR UPDATE OF io;

  IF v_os_id IS NULL THEN
    RAISE EXCEPTION 'Item não encontrado';
  END IF;

  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'unauthorized' USING ERRCODE = '42501';
    END IF;

    SELECT oficina_id INTO v_oficina_real
    FROM public.ordens_servico WHERE id = v_os_id;

    IF v_oficina_real IS NULL
       OR NOT public.has_oficina_access(auth.uid(), v_oficina_real) THEN
      RAISE EXCEPTION 'Sem permissão para esta OS' USING ERRCODE = '42501';
    END IF;
  ELSE
    SELECT oficina_id INTO v_oficina_real
    FROM public.ordens_servico WHERE id = v_os_id;
  END IF;

  IF v_os_status = 'finalizado' AND v_estoque_id IS NOT NULL AND v_quantidade > 0 THEN
    SELECT quantidade INTO v_estoque_qtd_atual
    FROM public.estoque
    WHERE id = v_estoque_id
    FOR UPDATE;

    IF v_estoque_qtd_atual IS NOT NULL THEN
      UPDATE public.estoque
      SET quantidade = quantidade + v_quantidade
      WHERE id = v_estoque_id;

      INSERT INTO public.estoque_movimentacoes (
        estoque_id, oficina_id, tipo, quantidade,
        quantidade_anterior, quantidade_nova,
        motivo, referencia_tipo, referencia_id
      ) VALUES (
        v_estoque_id, v_oficina_real, 'entrada', v_quantidade,
        v_estoque_qtd_atual, v_estoque_qtd_atual + v_quantidade,
        'Devolvido ao estoque (item removido de OS finalizada)',
        'itens_os', p_item_id
      );
    END IF;
  END IF;

  PERFORM set_config('app.allow_finalized_item_delete', 'on', true);

  DELETE FROM public.itens_os WHERE id = p_item_id;

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

REVOKE EXECUTE ON FUNCTION public.deletar_item_os_atomic(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.deletar_item_os_atomic(uuid, uuid) TO authenticated, service_role;

COMMIT;
