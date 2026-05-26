
-- =========================================================
-- 1) get_oficina_publica_by_slug
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_oficina_publica_by_slug(p_slug text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oficina_id uuid;
  v_result jsonb;
BEGIN
  SELECT oc.oficina_id INTO v_oficina_id
  FROM public.oficina_configuracoes oc
  WHERE oc.agendamento_online_slug = lower(trim(p_slug))
    AND oc.agendamento_online_ativo = true
  LIMIT 1;

  IF v_oficina_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'oficina_id', o.id,
    'nome', o.nome,
    'telefone', o.telefone,
    'endereco', o.endereco,
    'logo_url', o.logo_url,
    'tipo', o.tipo,
    'slug', oc.agendamento_online_slug,
    'horarios', oc.agendamento_online_horarios,
    'duracao_slot_minutos', oc.agendamento_online_duracao_slot_minutos,
    'capacidade_simultanea', oc.agendamento_online_capacidade_simultanea,
    'dias_antecedencia_max', oc.agendamento_online_dias_antecedencia_max,
    'mostrar_precos', oc.agendamento_online_mostrar_precos,
    'mensagem_confirmacao', oc.agendamento_online_mensagem_confirmacao,
    'servicos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', cs.id,
        'nome', cs.nome,
        'descricao', cs.descricao,
        'categoria', cs.categoria,
        'tipo_veiculo', cs.tipo_veiculo,
        'tempo_estimado_minutos', cs.tempo_estimado_minutos,
        'valor_mao_obra', CASE WHEN oc.agendamento_online_mostrar_precos THEN cs.valor_mao_obra ELSE NULL END
      ) ORDER BY cs.nome)
      FROM public.catalogo_servicos cs
      WHERE cs.oficina_id = v_oficina_id
        AND cs.ativo = true
        AND (
          array_length(oc.agendamento_online_servicos_permitidos, 1) IS NULL
          OR cs.id = ANY(oc.agendamento_online_servicos_permitidos)
        )
    ), '[]'::jsonb)
  ) INTO v_result
  FROM public.oficinas o
  JOIN public.oficina_configuracoes oc ON oc.oficina_id = o.id
  WHERE o.id = v_oficina_id;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_oficina_publica_by_slug(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_oficina_publica_by_slug(text) TO anon, authenticated;

-- =========================================================
-- 2) get_slots_disponiveis
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_slots_disponiveis(
  p_slug text,
  p_data date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oficina_id uuid;
  v_horarios jsonb;
  v_duracao int;
  v_capacidade int;
  v_dias_max int;
  v_dia_semana text;
  v_dia_cfg jsonb;
  v_abre time;
  v_fecha time;
  v_pausa_inicio time;
  v_pausa_fim time;
  v_slot_inicio time;
  v_slots jsonb := '[]'::jsonb;
  v_ocupados_count int;
  v_disponivel boolean;
BEGIN
  SELECT oc.oficina_id,
         oc.agendamento_online_horarios,
         oc.agendamento_online_duracao_slot_minutos,
         oc.agendamento_online_capacidade_simultanea,
         oc.agendamento_online_dias_antecedencia_max
    INTO v_oficina_id, v_horarios, v_duracao, v_capacidade, v_dias_max
  FROM public.oficina_configuracoes oc
  WHERE oc.agendamento_online_slug = lower(trim(p_slug))
    AND oc.agendamento_online_ativo = true
  LIMIT 1;

  IF v_oficina_id IS NULL THEN
    RETURN jsonb_build_object('erro', 'oficina_nao_encontrada', 'slots', '[]'::jsonb);
  END IF;

  IF p_data < CURRENT_DATE THEN
    RETURN jsonb_build_object('erro', 'data_passada', 'slots', '[]'::jsonb);
  END IF;

  IF p_data > CURRENT_DATE + v_dias_max THEN
    RETURN jsonb_build_object('erro', 'data_fora_janela', 'slots', '[]'::jsonb);
  END IF;

  v_dia_semana := CASE EXTRACT(DOW FROM p_data)::int
    WHEN 0 THEN 'dom' WHEN 1 THEN 'seg' WHEN 2 THEN 'ter'
    WHEN 3 THEN 'qua' WHEN 4 THEN 'qui' WHEN 5 THEN 'sex'
    WHEN 6 THEN 'sab'
  END;

  v_dia_cfg := v_horarios -> v_dia_semana;

  IF v_dia_cfg IS NULL OR COALESCE((v_dia_cfg->>'aberto')::boolean, false) = false THEN
    RETURN jsonb_build_object('erro', 'fechado', 'slots', '[]'::jsonb);
  END IF;

  v_abre := (v_dia_cfg->>'abre')::time;
  v_fecha := (v_dia_cfg->>'fecha')::time;
  v_pausa_inicio := NULLIF(v_dia_cfg->>'pausa_inicio','')::time;
  v_pausa_fim := NULLIF(v_dia_cfg->>'pausa_fim','')::time;

  v_slot_inicio := v_abre;
  WHILE v_slot_inicio + (v_duracao || ' minutes')::interval <= v_fecha LOOP
    -- pula pausa de almoço
    IF v_pausa_inicio IS NOT NULL AND v_pausa_fim IS NOT NULL
       AND v_slot_inicio < v_pausa_fim
       AND v_slot_inicio + (v_duracao || ' minutes')::interval > v_pausa_inicio THEN
      v_slot_inicio := v_pausa_fim;
      CONTINUE;
    END IF;

    -- conta OS já agendadas + solicitações pendentes nesse horário
    SELECT
      (SELECT COUNT(*) FROM public.ordens_servico os
        WHERE os.oficina_id = v_oficina_id
          AND os.data_servico = p_data
          AND os.hora_agendamento = v_slot_inicio
          AND os.status NOT IN ('cancelado','finalizado'))
      +
      (SELECT COUNT(*) FROM public.solicitacoes_agendamento sa
        WHERE sa.oficina_id = v_oficina_id
          AND sa.data_agendamento_solicitada = p_data
          AND sa.hora_agendamento_solicitada = v_slot_inicio
          AND sa.status IN ('pendente','aprovado'))
    INTO v_ocupados_count;

    v_disponivel := v_ocupados_count < v_capacidade;

    -- não exibir slots no passado para hoje
    IF p_data = CURRENT_DATE AND v_slot_inicio <= CURRENT_TIME THEN
      v_disponivel := false;
    END IF;

    IF v_disponivel THEN
      v_slots := v_slots || jsonb_build_array(to_char(v_slot_inicio, 'HH24:MI'));
    END IF;

    v_slot_inicio := v_slot_inicio + (v_duracao || ' minutes')::interval;
  END LOOP;

  RETURN jsonb_build_object(
    'data', p_data,
    'duracao_minutos', v_duracao,
    'slots', v_slots
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_slots_disponiveis(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_slots_disponiveis(text, date) TO anon, authenticated;

-- =========================================================
-- 3) solicitar_agendamento_publico
-- =========================================================
CREATE OR REPLACE FUNCTION public.solicitar_agendamento_publico(
  p_slug text,
  p_cliente_nome text,
  p_cliente_telefone text,
  p_cliente_email text,
  p_veiculo_placa text,
  p_veiculo_modelo text,
  p_servico_id uuid,
  p_data date,
  p_hora time,
  p_observacoes text,
  p_ip_solicitante text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oficina_id uuid;
  v_servico record;
  v_slots jsonb;
  v_slot_livre boolean := false;
  v_solicitacao_id uuid;
  v_rate_count int;
  v_ip inet;
BEGIN
  -- valida slug
  SELECT oc.oficina_id INTO v_oficina_id
  FROM public.oficina_configuracoes oc
  WHERE oc.agendamento_online_slug = lower(trim(p_slug))
    AND oc.agendamento_online_ativo = true
  LIMIT 1;

  IF v_oficina_id IS NULL THEN
    RAISE EXCEPTION 'Oficina não encontrada ou agendamento desativado' USING ERRCODE = 'P0001';
  END IF;

  -- validações de input
  IF p_cliente_nome IS NULL OR length(trim(p_cliente_nome)) < 2 THEN
    RAISE EXCEPTION 'Nome obrigatório' USING ERRCODE = 'P0001';
  END IF;
  IF p_cliente_telefone IS NULL OR length(regexp_replace(p_cliente_telefone, '\D', '', 'g')) < 10 THEN
    RAISE EXCEPTION 'Telefone inválido' USING ERRCODE = 'P0001';
  END IF;
  IF p_servico_id IS NULL THEN
    RAISE EXCEPTION 'Serviço obrigatório' USING ERRCODE = 'P0001';
  END IF;

  -- rate limit por IP: máx 3/hora
  IF p_ip_solicitante IS NOT NULL THEN
    BEGIN
      v_ip := p_ip_solicitante::inet;
      SELECT COUNT(*) INTO v_rate_count
      FROM public.solicitacoes_agendamento
      WHERE ip_solicitante = v_ip
        AND created_at > now() - interval '1 hour';
      IF v_rate_count >= 3 THEN
        RAISE EXCEPTION 'Muitas solicitações deste IP. Tente novamente em 1 hora.' USING ERRCODE = 'P0001';
      END IF;
    EXCEPTION WHEN invalid_text_representation THEN
      v_ip := NULL;
    END;
  END IF;

  -- valida serviço pertence à oficina e está permitido
  SELECT cs.id, cs.nome, cs.valor_mao_obra
    INTO v_servico
  FROM public.catalogo_servicos cs
  JOIN public.oficina_configuracoes oc ON oc.oficina_id = cs.oficina_id
  WHERE cs.id = p_servico_id
    AND cs.oficina_id = v_oficina_id
    AND cs.ativo = true
    AND (
      array_length(oc.agendamento_online_servicos_permitidos, 1) IS NULL
      OR cs.id = ANY(oc.agendamento_online_servicos_permitidos)
    );

  IF v_servico.id IS NULL THEN
    RAISE EXCEPTION 'Serviço inválido ou não disponível para agendamento online' USING ERRCODE = 'P0001';
  END IF;

  -- valida slot disponível
  v_slots := public.get_slots_disponiveis(p_slug, p_data);
  IF v_slots ? 'erro' THEN
    RAISE EXCEPTION 'Data indisponível: %', v_slots->>'erro' USING ERRCODE = 'P0001';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(v_slots->'slots') s
    WHERE s = to_char(p_hora, 'HH24:MI')
  ) INTO v_slot_livre;

  IF NOT v_slot_livre THEN
    RAISE EXCEPTION 'Horário não está mais disponível' USING ERRCODE = 'P0001';
  END IF;

  -- insere solicitação
  INSERT INTO public.solicitacoes_agendamento (
    oficina_id, cliente_nome, cliente_telefone, cliente_email,
    veiculo_placa, veiculo_modelo,
    servico_id, servico_nome, servico_valor_estimado,
    data_agendamento_solicitada, hora_agendamento_solicitada,
    observacoes_cliente, status, ip_solicitante
  ) VALUES (
    v_oficina_id, trim(p_cliente_nome), regexp_replace(p_cliente_telefone, '\D', '', 'g'),
    NULLIF(trim(COALESCE(p_cliente_email,'')), ''),
    NULLIF(upper(regexp_replace(COALESCE(p_veiculo_placa,''), '[^A-Z0-9]', '', 'g')), ''),
    NULLIF(trim(COALESCE(p_veiculo_modelo,'')), ''),
    v_servico.id, v_servico.nome, v_servico.valor_mao_obra,
    p_data, p_hora,
    NULLIF(trim(COALESCE(p_observacoes,'')), ''),
    'pendente', v_ip
  )
  RETURNING id INTO v_solicitacao_id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'solicitacao_id', v_solicitacao_id,
    'mensagem', 'Solicitação enviada! Aguarde a confirmação da oficina.'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.solicitar_agendamento_publico(text,text,text,text,text,text,uuid,date,time,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.solicitar_agendamento_publico(text,text,text,text,text,text,uuid,date,time,text,text) TO anon, authenticated;

-- =========================================================
-- 4) aprovar_solicitacao_agendamento
-- =========================================================
CREATE OR REPLACE FUNCTION public.aprovar_solicitacao_agendamento(
  p_solicitacao_id uuid,
  p_cliente_id uuid DEFAULT NULL,
  p_veiculo_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sol record;
  v_cliente_id uuid;
  v_veiculo_id uuid;
  v_os_id uuid;
  v_numero int;
BEGIN
  SELECT * INTO v_sol
  FROM public.solicitacoes_agendamento
  WHERE id = p_solicitacao_id
  FOR UPDATE;

  IF v_sol.id IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.has_oficina_access(auth.uid(), v_sol.oficina_id) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = 'P0001';
  END IF;

  IF v_sol.status <> 'pendente' THEN
    RAISE EXCEPTION 'Solicitação não está pendente (status: %)', v_sol.status USING ERRCODE = 'P0001';
  END IF;

  -- cliente: usa fornecido ou cria
  v_cliente_id := p_cliente_id;
  IF v_cliente_id IS NULL THEN
    -- tenta achar por telefone
    SELECT id INTO v_cliente_id
    FROM public.clientes
    WHERE oficina_id = v_sol.oficina_id
      AND regexp_replace(COALESCE(telefone,''), '\D', '', 'g') = v_sol.cliente_telefone
    LIMIT 1;

    IF v_cliente_id IS NULL THEN
      INSERT INTO public.clientes (oficina_id, nome, telefone, email)
      VALUES (v_sol.oficina_id, v_sol.cliente_nome, v_sol.cliente_telefone, v_sol.cliente_email)
      RETURNING id INTO v_cliente_id;
    END IF;
  END IF;

  -- veículo: usa fornecido ou cria se houver placa
  v_veiculo_id := p_veiculo_id;
  IF v_veiculo_id IS NULL AND v_sol.veiculo_placa IS NOT NULL THEN
    SELECT id INTO v_veiculo_id
    FROM public.veiculos
    WHERE cliente_id = v_cliente_id
      AND upper(regexp_replace(COALESCE(placa,''), '[^A-Z0-9]', '', 'g')) = v_sol.veiculo_placa
    LIMIT 1;

    IF v_veiculo_id IS NULL THEN
      INSERT INTO public.veiculos (oficina_id, cliente_id, placa, modelo, tipo)
      VALUES (v_sol.oficina_id, v_cliente_id, v_sol.veiculo_placa, COALESCE(v_sol.veiculo_modelo,'-'), 'carro')
      RETURNING id INTO v_veiculo_id;
    END IF;
  END IF;

  IF v_veiculo_id IS NULL THEN
    RAISE EXCEPTION 'Informe o veículo para criar a OS' USING ERRCODE = 'P0001';
  END IF;

  -- próximo número
  SELECT COALESCE(MAX(numero),0)+1 INTO v_numero
  FROM public.ordens_servico
  WHERE oficina_id = v_sol.oficina_id;

  -- cria OS
  INSERT INTO public.ordens_servico (
    oficina_id, cliente_id, veiculo_id, data_servico, hora_agendamento,
    tipo_servico, descricao, status, valor_mao_obra, numero,
    solicitacao_agendamento_id, observacoes
  ) VALUES (
    v_sol.oficina_id, v_cliente_id, v_veiculo_id,
    v_sol.data_agendamento_solicitada, v_sol.hora_agendamento_solicitada,
    v_sol.servico_nome, v_sol.servico_nome, 'pendente',
    COALESCE(v_sol.servico_valor_estimado, 0), v_numero,
    v_sol.id,
    CASE WHEN v_sol.observacoes_cliente IS NOT NULL
         THEN 'Obs. cliente: ' || v_sol.observacoes_cliente ELSE NULL END
  )
  RETURNING id INTO v_os_id;

  -- atualiza solicitação
  UPDATE public.solicitacoes_agendamento
  SET status = 'aprovado',
      data_aprovacao = now(),
      ordem_servico_id = v_os_id,
      updated_at = now()
  WHERE id = v_sol.id;

  RETURN jsonb_build_object(
    'sucesso', true,
    'ordem_servico_id', v_os_id,
    'numero_os', v_numero,
    'cliente_id', v_cliente_id,
    'veiculo_id', v_veiculo_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.aprovar_solicitacao_agendamento(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aprovar_solicitacao_agendamento(uuid,uuid,uuid) TO authenticated;

-- =========================================================
-- 5) recusar_solicitacao_agendamento
-- =========================================================
CREATE OR REPLACE FUNCTION public.recusar_solicitacao_agendamento(
  p_solicitacao_id uuid,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oficina_id uuid;
  v_status text;
BEGIN
  SELECT oficina_id, status INTO v_oficina_id, v_status
  FROM public.solicitacoes_agendamento
  WHERE id = p_solicitacao_id
  FOR UPDATE;

  IF v_oficina_id IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.has_oficina_access(auth.uid(), v_oficina_id) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = 'P0001';
  END IF;
  IF v_status NOT IN ('pendente','sugerido') THEN
    RAISE EXCEPTION 'Solicitação não pode ser recusada (status: %)', v_status USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.solicitacoes_agendamento
  SET status = 'recusado',
      data_recusa = now(),
      motivo_recusa = NULLIF(trim(COALESCE(p_motivo,'')), ''),
      updated_at = now()
  WHERE id = p_solicitacao_id;

  RETURN jsonb_build_object('sucesso', true);
END;
$$;

REVOKE ALL ON FUNCTION public.recusar_solicitacao_agendamento(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recusar_solicitacao_agendamento(uuid,text) TO authenticated;

-- =========================================================
-- 6) sugerir_novo_horario_agendamento
-- =========================================================
CREATE OR REPLACE FUNCTION public.sugerir_novo_horario_agendamento(
  p_solicitacao_id uuid,
  p_nova_data date,
  p_nova_hora time
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oficina_id uuid;
  v_status text;
BEGIN
  SELECT oficina_id, status INTO v_oficina_id, v_status
  FROM public.solicitacoes_agendamento
  WHERE id = p_solicitacao_id
  FOR UPDATE;

  IF v_oficina_id IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.has_oficina_access(auth.uid(), v_oficina_id) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = 'P0001';
  END IF;
  IF v_status <> 'pendente' THEN
    RAISE EXCEPTION 'Apenas solicitações pendentes podem receber sugestão' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.solicitacoes_agendamento
  SET status = 'sugerido',
      data_sugestao = now(),
      nova_data_sugerida = p_nova_data,
      nova_hora_sugerida = p_nova_hora,
      updated_at = now()
  WHERE id = p_solicitacao_id;

  RETURN jsonb_build_object('sucesso', true);
END;
$$;

REVOKE ALL ON FUNCTION public.sugerir_novo_horario_agendamento(uuid,date,time) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sugerir_novo_horario_agendamento(uuid,date,time) TO authenticated;

-- =========================================================
-- 7) cancelar_solicitacao_agendamento
-- =========================================================
CREATE OR REPLACE FUNCTION public.cancelar_solicitacao_agendamento(
  p_solicitacao_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_oficina_id uuid;
BEGIN
  SELECT oficina_id INTO v_oficina_id
  FROM public.solicitacoes_agendamento
  WHERE id = p_solicitacao_id
  FOR UPDATE;

  IF v_oficina_id IS NULL THEN
    RAISE EXCEPTION 'Solicitação não encontrada' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.has_oficina_access(auth.uid(), v_oficina_id) THEN
    RAISE EXCEPTION 'Sem permissão' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.solicitacoes_agendamento
  SET status = 'cancelado',
      updated_at = now()
  WHERE id = p_solicitacao_id;

  RETURN jsonb_build_object('sucesso', true);
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_solicitacao_agendamento(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancelar_solicitacao_agendamento(uuid) TO authenticated;
