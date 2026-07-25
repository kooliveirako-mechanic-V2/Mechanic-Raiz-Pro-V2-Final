-- LEGACY HOTFIX — Aplicado manualmente na produção viva.
-- Target project: cuhkkoqqeguascdsvtky (banco antigo, NÃO é o projeto linkado deste repo).
-- Data/hora UTC: 2026-07-25 14:42 (migration) / 14:50 (smoke test real).
-- Pre-patch MD5: 855778b3e87a36c125d4430b49d75d29 (805 bytes)
-- Post-patch MD5: 7a0b9ffcc5a7d88920ba75cf4fdf1286 (1097 bytes)
-- Corpo funcional preservado; adicionado apenas guard + search_path + lockdown de grants.
-- Este arquivo é registro de rastreabilidade; não é aplicado via `supabase db push` neste repo
-- (schemas antigo x novo divergem). Aplicação foi feita via SQL Editor no projeto antigo.

BEGIN;

CREATE OR REPLACE FUNCTION public.cancelar_venda_balcao(p_venda_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, pg_temp
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

    UPDATE public.vendas_balcao
    SET status = 'cancelada'
    WHERE id = p_venda_id;

    RETURN jsonb_build_object('success', true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.cancelar_venda_balcao(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_venda_balcao(uuid) TO authenticated, service_role;

COMMIT;
