CREATE OR REPLACE FUNCTION public.get_metrics_financeiras_unificadas(p_oficina_id uuid, p_data_inicio date, p_data_fim date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_has_access BOOLEAN;
    v_user_id UUID := auth.uid();
    v_user_role TEXT;
    v_user_oficina_id UUID;
    v_faturamento_bruto NUMERIC := 0;
    v_descontos NUMERIC := 0;
    v_faturamento_liquido NUMERIC := 0;
    v_custo_pecas NUMERIC := 0;
    v_lucro_operacional NUMERIC := 0;
    v_recebido_vinculado NUMERIC := 0;
    v_entradas_oficina NUMERIC := 0;
    v_saidas_oficina NUMERIC := 0;
    v_lucro_caixa_oficina NUMERIC := 0;
    v_saldo_a_receber NUMERIC := 0;
    v_total_itens_livres INTEGER := 0;
    v_total_itens_livres_sem_custo INTEGER := 0;
    v_valor_itens_livres_sem_custo NUMERIC := 0;
    v_alerta_lucro_inflado BOOLEAN := FALSE;
BEGIN
    -- 1. VALIDAÇÃO DE SEGURANÇA MULTI-TENANT RIGOROSA
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autenticado.';
    END IF;

    -- Busca dados do perfil do usuário
    SELECT role, oficina_id INTO v_user_role, v_user_oficina_id
    FROM profiles 
    WHERE id = v_user_id;

    -- Lógica de permissão:
    -- Usuário comum ou admin só acessa a PRÓPRIA oficina (oficina_id = p_oficina_id)
    -- Somente roles de plataforma (master, super_admin, platform_admin) acessam qualquer oficina
    v_has_access := (
        v_user_oficina_id = p_oficina_id 
        OR v_user_role IN ('master', 'super_admin', 'platform_admin')
    );

    IF NOT v_has_access OR v_has_access IS NULL THEN
        RAISE EXCEPTION 'Acesso negado: Usuário não autorizado para esta oficina.';
    END IF;

    -- 2. CÁLCULOS DE COMPETÊNCIA (OS FINALIZADAS NO PERÍODO)
    SELECT 
        COALESCE(SUM(valor_servico), 0),
        COALESCE(SUM(desconto), 0),
        COALESCE(SUM(valor_servico - desconto), 0)
    INTO v_faturamento_bruto, v_descontos, v_faturamento_liquido
    FROM ordens_servico
    WHERE oficina_id = p_oficina_id
    AND status = 'finalizado'
    AND data_conclusao BETWEEN p_data_inicio AND p_data_fim;

    -- Custo de Peças das OS finalizadas
    SELECT COALESCE(SUM(io.quantidade * io.custo_unitario), 0)
    INTO v_custo_pecas
    FROM itens_os io
    JOIN ordens_servico os ON io.ordem_servico_id = os.id
    WHERE os.oficina_id = p_oficina_id
    AND os.status = 'finalizado'
    AND os.data_conclusao BETWEEN p_data_inicio AND p_data_fim
    AND io.tipo = 'produto';

    v_lucro_operacional := v_faturamento_liquido - v_custo_pecas;

    -- 3. CÁLCULOS DE CAIXA (MOVIMENTAÇÕES REAIS DA OFICINA NO PERÍODO)
    -- Entradas globais da oficina no período (Global da Oficina, NÃO do banco)
    SELECT COALESCE(SUM(valor), 0)
    INTO v_entradas_oficina
    FROM financeiro
    WHERE oficina_id = p_oficina_id
    AND tipo = 'entrada'
    AND data BETWEEN p_data_inicio AND p_data_fim;

    -- Saídas globais da oficina no período
    SELECT COALESCE(SUM(valor), 0)
    INTO v_saidas_oficina
    FROM financeiro
    WHERE oficina_id = p_oficina_id
    AND tipo = 'saida'
    AND data BETWEEN p_data_inicio AND p_data_fim;

    v_lucro_caixa_oficina := v_entradas_oficina - v_saidas_oficina;

    -- Recebimentos VINCULADOS às OS de competência
    SELECT COALESCE(SUM(f.valor), 0)
    INTO v_recebido_vinculado
    FROM financeiro f
    JOIN ordens_servico os ON f.ordem_servico_id = os.id
    WHERE os.oficina_id = p_oficina_id
    AND os.status = 'finalizado'
    AND os.data_conclusao BETWEEN p_data_inicio AND p_data_fim
    AND f.tipo = 'entrada';

    v_saldo_a_receber := v_faturamento_liquido - v_recebido_vinculado;

    -- 4. AUDITORIA E ALERTAS
    SELECT COUNT(*), COUNT(*) FILTER (WHERE custo_unitario = 0 OR custo_unitario IS NULL), COALESCE(SUM(quantidade * valor_unitario) FILTER (WHERE custo_unitario = 0 OR custo_unitario IS NULL), 0)
    INTO v_total_itens_livres, v_total_itens_livres_sem_custo, v_valor_itens_livres_sem_custo
    FROM itens_os io
    JOIN ordens_servico os ON io.ordem_servico_id = os.id
    WHERE os.oficina_id = p_oficina_id
    AND os.status = 'finalizado'
    AND os.data_conclusao BETWEEN p_data_inicio AND p_data_fim
    AND io.estoque_id IS NULL;

    IF v_total_itens_livres_sem_custo > 0 THEN
        v_alerta_lucro_inflado := TRUE;
    END IF;

    -- 5. RETORNO DO JSON UNIFICADO
    RETURN jsonb_build_object(
        'periodo', jsonb_build_object('inicio', p_data_inicio, 'fim', p_data_fim),
        'faturamento', jsonb_build_object('bruto', v_faturamento_bruto, 'descontos', v_descontos, 'liquido', v_faturamento_liquido),
        'operacional', jsonb_build_object('custo_pecas', v_custo_pecas, 'lucro_operacional', v_lucro_operacional),
        'caixa', jsonb_build_object(
            'entradas_oficina_periodo', v_entradas_oficina,
            'saidas_oficina_periodo', v_saidas_oficina,
            'lucro_caixa_oficina_periodo', v_lucro_caixa_oficina,
            'recebido_vinculado_competencia', v_recebido_vinculado,
            'saldo_a_receber_competencia', v_saldo_a_receber
        ),
        'auditoria', jsonb_build_object(
            'total_itens_livres', v_total_itens_livres,
            'total_itens_livres_sem_custo', v_total_itens_livres_sem_custo,
            'valor_itens_livres_sem_custo', v_valor_itens_livres_sem_custo,
            'alerta_lucro_inflado', v_alerta_lucro_inflado
        ),
        'categorias', jsonb_build_object(
            'pecas', jsonb_build_object('bruto', 0, 'liquido', 0), -- Placeholder para expansão futura
            'servicos', jsonb_build_object('bruto', 0, 'liquido', 0)
        )
    );
END;
$function$
;