CREATE OR REPLACE FUNCTION public.cancelar_venda_balcao(p_venda_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
    v_venda RECORD;
BEGIN
    IF COALESCE(auth.role(), '') <> 'service_role'
       AND (
         auth.uid() IS NULL
         OR NOT COALESCE(
           public.has_oficina_access(
             auth.uid(),
             (SELECT oficina_id FROM public.vendas_balcao WHERE id = p_venda_id)
           ),
           false
         )
       ) THEN
        RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
    END IF;

    SELECT * INTO v_venda FROM public.vendas_balcao WHERE id = p_venda_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Venda não encontrada');
    END IF;

    IF v_venda.status = 'cancelada' THEN
        RETURN jsonb_build_object('success', true, 'message', 'Venda já cancelada');
    END IF;

    -- O estorno de estoque e financeiro será disparado pelo trigger de update de status ou delete
    UPDATE public.vendas_balcao
    SET status = 'cancelada'
    WHERE id = p_venda_id;

    RETURN jsonb_build_object('success', true);
END;
$function$

