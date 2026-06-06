-- Removemos a lógica de estorno de estoque da função fn_tg_reabrir_os
-- pois agora temos a trigger_estornar_estoque_os que faz isso de forma auditada.

CREATE OR REPLACE FUNCTION public.fn_tg_reabrir_os()
 RETURNS trigger
 LANGUAGE plpgsql
 AS $function$
DECLARE
    v_item RECORD;
BEGIN
    -- Se mudar de 'finalizado' para qualquer outro status
    IF OLD.status = 'finalizado' AND NEW.status != 'finalizado' THEN
        
        -- A. LOG DA REABERTURA
        INSERT INTO public.log_financeiro_estoque_audit (
            oficina_id, entidade_tipo, entidade_id, acao, dados_anteriores
        )
        VALUES (
            OLD.oficina_id, 
            'ordem_servico', 
            OLD.id, 
            'reabertura', 
            jsonb_build_object('status', OLD.status, 'numero', OLD.numero, 'valor_servico', OLD.valor_servico)
        );

        -- B. ESTORNO DE ESTOQUE FOI REMOVIDO DAQUI (Delegado para trigger_estornar_estoque_os)
        -- Isso evita duplicidade no saldo.

        -- C. PROTEÇÃO DO CAIXA REAL
        -- Marcamos lançamentos pagos como 'reabertos' na observação, mas mantemos o registro
        UPDATE public.financeiro
        SET observacoes_contador = COALESCE(observacoes_contador, '') || ' [OS #' || OLD.numero || ' REABERTA - Pagamento mantido no caixa]',
            updated_at = now()
        WHERE ordem_servico_id = OLD.id
        AND status = 'pago';

        -- Cancelamos o que ainda não foi recebido
        UPDATE public.financeiro
        SET status = 'cancelado',
            observacoes_contador = COALESCE(observacoes_contador, '') || ' [Cancelado por reabertura OS #' || OLD.numero || ']',
            updated_at = now()
        WHERE ordem_servico_id = OLD.id
        AND status IN ('a_receber', 'a_pagar');

    END IF;
    
    RETURN NEW;
END;
$function$;
