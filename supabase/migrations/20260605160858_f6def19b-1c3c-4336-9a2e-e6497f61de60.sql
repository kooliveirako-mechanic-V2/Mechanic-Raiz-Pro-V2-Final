-- 1. Tabela de Auditoria (Garantir existência)
CREATE TABLE IF NOT EXISTS public.log_financeiro_estoque_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oficina_id UUID NOT NULL REFERENCES public.oficinas(id),
    entidade_tipo TEXT NOT NULL,
    entidade_id UUID NOT NULL,
    acao TEXT NOT NULL,
    dados_anteriores JSONB,
    dados_novos JSONB,
    usuario_id UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Garantir GRANTs
GRANT SELECT, INSERT ON public.log_financeiro_estoque_audit TO authenticated;
GRANT ALL ON public.log_financeiro_estoque_audit TO service_role;

-- 2. Função de Trigger Corrigida
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
        -- Usamos um loop para garantir que o estoque seja atualizado e logado
        FOR v_item IN 
            SELECT io.estoque_id, io.quantidade, io.nome_item
            FROM public.itens_os io
            WHERE io.ordem_servico_id = OLD.id
            AND io.estoque_id IS NOT NULL
        LOOP
            UPDATE public.estoque e
            SET quantidade_atual = e.quantidade_atual + v_item.quantidade,
                updated_at = now()
            WHERE e.id = v_item.estoque_id;
            
            -- Opcional: Log de movimentação de estoque se a tabela existir
            -- INSERT INTO public.estoque_movimentacoes ...
        END LOOP;

        -- C. PROTEÇÃO DO CAIXA REAL
        -- 1. Financeiro PAGO: NÃO cancela. Mantém como 'pago' mas vincula à reabertura (muda descrição/obs).
        UPDATE public.financeiro
        SET observacoes_contador = COALESCE(observacoes_contador, '') || ' [OS #' || OLD.numero || ' REABERTA - Pagamento mantido no caixa]',
            updated_at = now()
        WHERE ordem_servico_id = OLD.id
        AND status = 'pago';

        -- 2. Financeiro PENDENTE: Cancela (pois a OS será editada e novos lançamentos virão).
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

-- 3. Re-vincular Trigger
DROP TRIGGER IF EXISTS tg_reabrir_os ON public.ordens_servico;
CREATE TRIGGER tg_reabrir_os
BEFORE UPDATE OF status ON public.ordens_servico
FOR EACH ROW
EXECUTE FUNCTION public.fn_tg_reabrir_os();

-- 4. Função Atômica de Reabertura (para ser chamada pelo Frontend)
CREATE OR REPLACE FUNCTION public.reabrir_os_v2(p_os_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_os_numero TEXT;
    v_oficina_id UUID;
BEGIN
    -- Lock para evitar race conditions
    SELECT numero::text, oficina_id INTO v_os_numero, v_oficina_id
    FROM public.ordens_servico
    WHERE id = p_os_id AND status = 'finalizado'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'message', 'OS não encontrada ou não está no status finalizado.');
    END IF;

    -- O update disparará a trigger tg_reabrir_os que cuida do estoque e financeiro
    UPDATE public.ordens_servico
    SET status = 'em_andamento',
        data_conclusao = NULL,
        updated_at = now()
    WHERE id = p_os_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'OS #' || v_os_numero || ' reaberta. Estoque estornado. Pagamentos realizados foram mantidos no caixa.',
        'os_id', p_os_id
    );
END;
$function$;

-- Grant para a nova função
GRANT EXECUTE ON FUNCTION public.reabrir_os_v2(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reabrir_os_v2(uuid) TO service_role;
