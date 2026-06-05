-- BLOQUEIO 1: RPC para Séries Temporais Unificadas
CREATE OR REPLACE FUNCTION public.get_financeiro_series_unificadas(p_oficina_id uuid, p_data_inicio date, p_data_fim date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_user_id UUID;
    v_user_oficina_id UUID;
    v_user_role TEXT;
    v_result JSONB;
BEGIN
    -- Validação Multi-tenant
    v_user_id := auth.uid();
    SELECT oficina_id INTO v_user_oficina_id FROM public.profiles WHERE id = v_user_id;
    SELECT role INTO v_user_role FROM public.user_roles WHERE user_id = v_user_id LIMIT 1;

    IF v_user_oficina_id != p_oficina_id AND v_user_role NOT IN ('master', 'super_admin', 'platform_admin') THEN
        RAISE EXCEPTION 'Acesso negado: multi-tenant violation';
    END IF;

    WITH meses AS (
        SELECT generate_series(
            date_trunc('month', p_data_inicio),
            date_trunc('month', p_data_fim),
            '1 month'::interval
        )::date as mes_referencia
    ),
    dados_competencia AS (
        SELECT 
            date_trunc('month', data_servico)::date as mes,
            SUM(COALESCE(valor_servico, 0) - COALESCE(desconto, 0)) as faturamento_liquido,
            SUM(COALESCE(valor_mao_obra, 0)) as servicos_liquido,
            SUM(COALESCE(valor_servico, 0) - COALESCE(valor_mao_obra, 0) - COALESCE(desconto, 0)) as pecas_liquido,
            SUM(COALESCE(lucro, 0)) as lucro_operacional
        FROM public.ordens_servico
        WHERE oficina_id = p_oficina_id 
        AND status = 'finalizado'
        AND data_servico BETWEEN p_data_inicio AND p_data_fim
        GROUP BY 1
    ),
    dados_caixa AS (
        SELECT 
            date_trunc('month', data_pagamento)::date as mes,
            SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE 0 END) as entradas,
            SUM(CASE WHEN tipo = 'saida' THEN valor ELSE 0 END) as saidas
        FROM public.financeiro
        WHERE oficina_id = p_oficina_id
        AND data_pagamento BETWEEN p_data_inicio AND p_data_fim
        GROUP BY 1
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'mes', to_char(m.mes_referencia, 'yyyy-mm-dd'),
            'label', to_char(m.mes_referencia, 'Mon'),
            'faturamento_liquido', COALESCE(dc.faturamento_liquido, 0),
            'pecas_liquido', COALESCE(dc.pecas_liquido, 0),
            'servicos_liquido', COALESCE(dc.servicos_liquido, 0),
            'lucro_operacional', COALESCE(dc.lucro_operacional, 0),
            'entradas_caixa', COALESCE(dx.entradas, 0),
            'saidas_caixa', COALESCE(dx.saidas, 0),
            'lucro_caixa', COALESCE(dx.entradas - dx.saidas, 0)
        )
        ORDER BY m.mes_referencia ASC
    ) INTO v_result
    FROM meses m
    LEFT JOIN dados_competencia dc ON dc.mes = m.mes_referencia
    LEFT JOIN dados_caixa dx ON dx.mes = m.mes_referencia;

    RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_financeiro_series_unificadas TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_financeiro_series_unificadas TO service_role;

-- BLOQUEIO 3/4: Tabela de Log e Trigger de Reabertura
CREATE TABLE IF NOT EXISTS public.log_financeiro_estoque_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    oficina_id UUID NOT NULL REFERENCES public.oficinas(id),
    entidade_tipo TEXT NOT NULL, -- 'ordem_servico', 'item_os', 'financeiro'
    entidade_id UUID NOT NULL,
    acao TEXT NOT NULL, -- 'reabertura', 'backfill', 'estorno'
    dados_anteriores JSONB,
    dados_novos JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT ON public.log_financeiro_estoque_audit TO authenticated;
GRANT ALL ON public.log_financeiro_estoque_audit TO service_role;
ALTER TABLE public.log_financeiro_estoque_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view logs of their oficina" ON public.log_financeiro_estoque_audit 
FOR SELECT USING (oficina_id = (SELECT oficina_id FROM public.profiles WHERE id = auth.uid()));

CREATE OR REPLACE FUNCTION public.fn_tg_reabrir_os()
RETURNS TRIGGER AS $$
BEGIN
    -- Se mudar de 'finalizado' para qualquer outro status
    IF OLD.status = 'finalizado' AND NEW.status != 'finalizado' THEN
        -- 1. Log da reabertura
        INSERT INTO public.log_financeiro_estoque_audit (oficina_id, entidade_tipo, entidade_id, acao, dados_anteriores)
        VALUES (OLD.oficina_id, 'ordem_servico', OLD.id, 'reabertura', row_to_json(OLD)::jsonb);

        -- 2. Estornar Estoque
        UPDATE public.estoque e
        SET quantidade_atual = e.quantidade_atual + io.quantidade
        FROM public.itens_os io
        WHERE io.ordem_servico_id = OLD.id
        AND io.estoque_id = e.id;

        -- 3. Marcar Financeiro Vinculado como 'cancelado' para não contar no caixa
        UPDATE public.financeiro
        SET status = 'cancelado',
            descricao = COALESCE(descricao, '') || ' (Estornado por reabertura da OS #' || COALESCE(OLD.numero::text, '') || ')'
        WHERE ordem_servico_id = OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tg_reabrir_os ON public.ordens_servico;
CREATE TRIGGER tg_reabrir_os
BEFORE UPDATE OF status ON public.ordens_servico
FOR EACH ROW
EXECUTE FUNCTION public.fn_tg_reabrir_os();
