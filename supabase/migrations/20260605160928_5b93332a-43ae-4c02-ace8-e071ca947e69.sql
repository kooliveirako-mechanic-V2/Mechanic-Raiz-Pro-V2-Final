CREATE OR REPLACE FUNCTION public.fn_tg_reabrir_os()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_item RECORD;
BEGIN
    -- Se mudar de 'finalizado' para qualquer outro status
    IF OLD.status = 'finalizado' AND NEW.status != 'finalizado' THEN
        
        -- A. LOG DA REABERTURA
        INSERT INTO public.log_financeiro_estoque_audit (
            oficina_id, entidade_tipo, entidade_id, acao, dados_anteriores, usuario_id
        )
        VALUES (
            OLD.oficina_id, 
            'ordem_servico', 
            OLD.id, 
            'reabertura', 
            jsonb_build_object('status', OLD.status, 'numero', OLD.numero, 'valor_total', OLD.valor_total),
            auth.uid()
        );

        -- B. ESTORNAR ESTOQUE (Apenas itens que foram baixados)
        FOR v_item IN 
            SELECT io.estoque_id, io.quantidade, io.nome_item
            FROM public.itens_os io
            WHERE io.ordem_servico_id = OLD.id
            AND io.estoque_id IS NOT NULL
        LOOP
            UPDATE public.estoque e
            SET quantidade = e.quantidade + v_item.quantidade,
                updated_at = now()
            WHERE e.id = v_item.estoque_id;
        END LOOP;

        -- C. PROTEÇÃO DO CAIXA REAL
        UPDATE public.financeiro
        SET observacoes_contador = COALESCE(observacoes_contador, '') || ' [OS #' || OLD.numero || ' REABERTA - Pagamento mantido no caixa]',
            updated_at = now()
        WHERE ordem_servico_id = OLD.id
        AND status = 'pago';

        UPDATE public.financeiro
        SET status = 'cancelado',
            observacoes_contador = COALESCE(observacoes_contador, '') || ' [Cancelado por reabertura OS #' || OLD.numero || ']',
            updated_at = now()
        WHERE ordem_servico_id = OLD.id
        AND status = 'pendente';

    END IF;
    
    RETURN NEW;
END;
$function$;
