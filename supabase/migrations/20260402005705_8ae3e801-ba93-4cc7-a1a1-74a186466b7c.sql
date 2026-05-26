-- ═══════════════════════════════════════════════════════════════════
-- FIX 1: Race condition na finalização financeira de OS
-- Adiciona pg_advisory_xact_lock para serializar operações por OS
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.upsert_financeiro_os(
  p_oficina_id uuid,
  p_ordem_servico_id uuid,
  p_tipo_servico text,
  p_valor_mao_de_obra numeric,
  p_forma_pagamento_id uuid DEFAULT NULL,
  p_origem text DEFAULT NULL,
  p_numero_parcelas integer DEFAULT 1
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_itens numeric;
  v_valor_total numeric;
  v_existing_id uuid;
  v_parcela_valor numeric;
  v_data_base date;
  v_i integer;
  v_num_parcelas integer;
  v_responsavel_id uuid;
  v_comissao_pct numeric;
  v_comissao_valor numeric;
  v_responsavel_nome text;
  v_os_numero integer;
  v_lock_key bigint;
BEGIN
  -- ═══════════════════════════════════════════════════════════════
  -- RACE CONDITION FIX: Advisory lock por ordem_servico_id
  -- Serializa todas as tentativas concorrentes para a mesma OS
  -- O lock é liberado automaticamente ao final da transação
  -- ═══════════════════════════════════════════════════════════════
  v_lock_key := ('x' || left(replace(p_ordem_servico_id::text, '-', ''), 15))::bit(64)::bigint;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Check if financial record already exists for this OS (now safe under lock)
  SELECT id INTO v_existing_id
  FROM public.financeiro
  WHERE ordem_servico_id = p_ordem_servico_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN json_build_object('success', true, 'action', 'exists', 'id', v_existing_id);
  END IF;

  -- Validate valor_mao_de_obra (prevent negative values)
  IF COALESCE(p_valor_mao_de_obra, 0) < 0 THEN
    RETURN json_build_object('success', false, 'error', 'Valor de mão de obra não pode ser negativo');
  END IF;

  -- Calculate total from itens_os
  SELECT COALESCE(SUM(COALESCE(valor_total, quantidade * valor_unitario, 0)), 0)
  INTO v_total_itens
  FROM public.itens_os
  WHERE ordem_servico_id = p_ordem_servico_id;

  v_valor_total := COALESCE(p_valor_mao_de_obra, 0) + v_total_itens;

  IF v_valor_total <= 0 THEN
    RETURN json_build_object('success', true, 'action', 'skipped', 'reason', 'zero_value');
  END IF;

  v_num_parcelas := GREATEST(COALESCE(p_numero_parcelas, 1), 1);
  -- Limit max parcelas to prevent abuse
  IF v_num_parcelas > 24 THEN
    v_num_parcelas := 24;
  END IF;
  
  v_parcela_valor := ROUND(v_valor_total / v_num_parcelas, 2);
  v_data_base := CURRENT_DATE;

  IF v_num_parcelas = 1 THEN
    INSERT INTO public.financeiro (
      oficina_id, ordem_servico_id, tipo, origem, valor, data, descricao, status, forma_pagamento_id
    ) VALUES (
      p_oficina_id, p_ordem_servico_id, 'entrada',
      COALESCE(p_origem, 'Serviço ' || p_tipo_servico),
      v_valor_total, CURRENT_DATE,
      p_tipo_servico || ' - OS Finalizada' || 
        CASE WHEN v_total_itens > 0 
          THEN ' (inclui R$' || TRIM(TO_CHAR(v_total_itens, 'FM999999990.00')) || ' em itens)'
          ELSE ''
        END,
      'pago', p_forma_pagamento_id
    )
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_existing_id;
  ELSE
    FOR v_i IN 1..v_num_parcelas LOOP
      IF v_i = v_num_parcelas THEN
        v_parcela_valor := v_valor_total - (ROUND(v_valor_total / v_num_parcelas, 2) * (v_num_parcelas - 1));
      END IF;

      INSERT INTO public.financeiro (
        oficina_id, ordem_servico_id, tipo, origem, valor, data, descricao, status, forma_pagamento_id
      ) VALUES (
        p_oficina_id, p_ordem_servico_id, 'entrada',
        COALESCE(p_origem, 'Serviço ' || p_tipo_servico),
        v_parcela_valor,
        v_data_base + (v_i - 1) * INTERVAL '1 month',
        'Parcela ' || v_i || '/' || v_num_parcelas || ' — ' || p_tipo_servico,
        CASE WHEN v_i = 1 THEN 'pago' ELSE 'a_receber' END,
        p_forma_pagamento_id
      );
    END LOOP;
  END IF;

  -- AUTO-COMMISSION: Check if OS has a responsavel with commission configured
  SELECT os.responsavel_id, os.numero
  INTO v_responsavel_id, v_os_numero
  FROM public.ordens_servico os
  WHERE os.id = p_ordem_servico_id;

  IF v_responsavel_id IS NOT NULL THEN
    SELECT cf.percentual INTO v_comissao_pct
    FROM public.comissoes_funcionarios cf
    WHERE cf.oficina_id = p_oficina_id
      AND cf.user_id = v_responsavel_id
      AND cf.ativo = true;

    IF v_comissao_pct IS NOT NULL AND v_comissao_pct > 0 THEN
      v_comissao_valor := ROUND(COALESCE(p_valor_mao_de_obra, 0) * v_comissao_pct / 100, 2);
      
      IF v_comissao_valor > 0 THEN
        SELECT COALESCE(p.nome, 'Funcionário') INTO v_responsavel_nome
        FROM public.profiles p
        WHERE p.user_id = v_responsavel_id;

        INSERT INTO public.financeiro (
          oficina_id, ordem_servico_id, tipo, origem, valor, data, descricao, status
        ) VALUES (
          p_oficina_id, p_ordem_servico_id, 'saida',
          'Comissão',
          v_comissao_valor, CURRENT_DATE,
          'Comissão ' || v_responsavel_nome || ' (' || TRIM(TO_CHAR(v_comissao_pct, 'FM990')) || '%) — OS #' || COALESCE(v_os_numero::text, ''),
          'a_pagar'
        );
      END IF;
    END IF;
  END IF;

  RETURN json_build_object('success', true, 'action', 'created', 'valor', v_valor_total, 'parcelas', v_num_parcelas);

EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- FIX 2: Race condition na aprovação de orçamento público
-- Adiciona SELECT FOR UPDATE para serializar aprovações
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.public_approve_orcamento(p_orcamento_id uuid, p_action text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_oficina_id uuid;
  v_orcamento_status text;
  v_orcamento_numero integer;
  v_cliente_nome text;
  v_new_status text;
  v_ip_hash text;
BEGIN
  -- Rate limit check
  v_ip_hash := md5(COALESCE(current_setting('request.headers', true)::json->>'x-forwarded-for', 'unknown'));
  IF NOT check_rate_limit(v_ip_hash, 'public_approve_orcamento') THEN
    RETURN json_build_object('success', false, 'error', 'Muitas requisições. Tente novamente em 1 minuto.');
  END IF;

  IF p_action NOT IN ('aprovar', 'rejeitar') THEN
    RETURN json_build_object('success', false, 'error', 'Ação inválida');
  END IF;

  -- ═══════════════════════════════════════════════════════════════
  -- RACE CONDITION FIX: FOR UPDATE locks the row for this transaction
  -- Prevents two simultaneous approvals from both succeeding
  -- ═══════════════════════════════════════════════════════════════
  SELECT o.status, o.oficina_id, o.numero, c.nome
  INTO v_orcamento_status, v_oficina_id, v_orcamento_numero, v_cliente_nome
  FROM public.orcamentos o
  LEFT JOIN public.clientes c ON c.id = o.cliente_id
  WHERE o.id = p_orcamento_id
  FOR UPDATE OF o;

  IF v_orcamento_status IS NULL THEN
    RETURN json_build_object('success', false, 'error', 'Orçamento não encontrado');
  END IF;

  IF v_orcamento_status <> 'enviado' THEN
    RETURN json_build_object('success', false, 'error', 'Este orçamento não está aguardando aprovação');
  END IF;

  v_new_status := CASE WHEN p_action = 'aprovar' THEN 'aprovado' ELSE 'rejeitado' END;

  UPDATE public.orcamentos
  SET status = v_new_status, updated_at = now()
  WHERE id = p_orcamento_id;

  INSERT INTO public.notificacoes (oficina_id, tipo, titulo, mensagem, referencia_id, referencia_tipo)
  VALUES (
    v_oficina_id,
    'orcamento',
    CASE WHEN p_action = 'aprovar' 
      THEN '✅ Orçamento #' || COALESCE(v_orcamento_numero::text, '') || ' Aprovado!'
      ELSE '❌ Orçamento #' || COALESCE(v_orcamento_numero::text, '') || ' Rejeitado'
    END,
    'O cliente ' || COALESCE(v_cliente_nome, '') || ' ' || 
    CASE WHEN p_action = 'aprovar' THEN 'aprovou' ELSE 'rejeitou' END || 
    ' o orçamento pelo link público.',
    p_orcamento_id,
    'orcamento'
  );

  RETURN json_build_object('success', true, 'new_status', v_new_status);
END;
$$;

-- ═══════════════════════════════════════════════════════════════════
-- FIX 3: Validação de valor mínimo para OS (impede valores negativos)
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.validate_os_valores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Impedir valor_servico negativo
  IF NEW.valor_servico IS NOT NULL AND NEW.valor_servico < 0 THEN
    RAISE EXCEPTION 'valor_servico não pode ser negativo: %', NEW.valor_servico;
  END IF;
  
  -- Impedir custo_servico negativo
  IF NEW.custo_servico IS NOT NULL AND NEW.custo_servico < 0 THEN
    RAISE EXCEPTION 'custo_servico não pode ser negativo: %', NEW.custo_servico;
  END IF;
  
  -- Limitar tamanhos de campos text críticos
  IF NEW.descricao IS NOT NULL AND LENGTH(NEW.descricao) > 5000 THEN
    NEW.descricao := LEFT(NEW.descricao, 5000);
  END IF;
  
  IF NEW.observacoes IS NOT NULL AND LENGTH(NEW.observacoes) > 5000 THEN
    NEW.observacoes := LEFT(NEW.observacoes, 5000);
  END IF;
  
  IF NEW.observacoes_conclusao IS NOT NULL AND LENGTH(NEW.observacoes_conclusao) > 5000 THEN
    NEW.observacoes_conclusao := LEFT(NEW.observacoes_conclusao, 5000);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach trigger (drop first if exists to be idempotent)
DROP TRIGGER IF EXISTS trg_validate_os_valores ON public.ordens_servico;
CREATE TRIGGER trg_validate_os_valores
  BEFORE INSERT OR UPDATE ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION validate_os_valores();

-- ═══════════════════════════════════════════════════════════════════
-- FIX 4: Validação de valor mínimo para financeiro (impede entradas negativas)
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.validate_financeiro_valores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Impedir valor negativo em QUALQUER registro financeiro
  IF NEW.valor IS NOT NULL AND NEW.valor < 0 THEN
    RAISE EXCEPTION 'valor financeiro não pode ser negativo: %', NEW.valor;
  END IF;
  
  -- Limitar tamanhos de campos text
  IF NEW.descricao IS NOT NULL AND LENGTH(NEW.descricao) > 2000 THEN
    NEW.descricao := LEFT(NEW.descricao, 2000);
  END IF;
  
  IF NEW.observacoes_contador IS NOT NULL AND LENGTH(NEW.observacoes_contador) > 2000 THEN
    NEW.observacoes_contador := LEFT(NEW.observacoes_contador, 2000);
  END IF;
  
  -- Validar que URLs de comprovante são do Supabase Storage
  IF NEW.comprovante_url IS NOT NULL AND NEW.comprovante_url != '' THEN
    IF NEW.comprovante_url NOT LIKE '%supabase%' AND NEW.comprovante_url NOT LIKE '/storage/%' THEN
      NEW.comprovante_url := NULL; -- Reject external URLs
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_financeiro_valores ON public.financeiro;
CREATE TRIGGER trg_validate_financeiro_valores
  BEFORE INSERT OR UPDATE ON public.financeiro
  FOR EACH ROW
  EXECUTE FUNCTION validate_financeiro_valores();

-- ═══════════════════════════════════════════════════════════════════
-- FIX 5: Validação de URLs de imagem (bloquear URLs externas)
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.validate_image_urls()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Validar logo_url: só aceitar URLs do Supabase Storage ou null
  IF TG_TABLE_NAME = 'oficinas' THEN
    IF NEW.logo_url IS NOT NULL AND NEW.logo_url != '' THEN
      IF NEW.logo_url NOT LIKE '%supabase%' AND NEW.logo_url NOT LIKE '/storage/%' AND NEW.logo_url NOT LIKE 'blob:%' THEN
        NEW.logo_url := NULL;
      END IF;
    END IF;
  END IF;
  
  -- Validar foto_url em veiculos
  IF TG_TABLE_NAME = 'veiculos' THEN
    IF NEW.foto_url IS NOT NULL AND NEW.foto_url != '' THEN
      IF NEW.foto_url NOT LIKE '%supabase%' AND NEW.foto_url NOT LIKE '/storage/%' AND NEW.foto_url NOT LIKE 'blob:%' THEN
        NEW.foto_url := NULL;
      END IF;
    END IF;
  END IF;
  
  -- Validar avatar_url em profiles
  IF TG_TABLE_NAME = 'profiles' THEN
    IF NEW.avatar_url IS NOT NULL AND NEW.avatar_url != '' THEN
      IF NEW.avatar_url NOT LIKE '%supabase%' AND NEW.avatar_url NOT LIKE '/storage/%' AND NEW.avatar_url NOT LIKE 'blob:%' THEN
        NEW.avatar_url := NULL;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_image_urls_oficinas ON public.oficinas;
CREATE TRIGGER trg_validate_image_urls_oficinas
  BEFORE INSERT OR UPDATE ON public.oficinas
  FOR EACH ROW
  EXECUTE FUNCTION validate_image_urls();

DROP TRIGGER IF EXISTS trg_validate_image_urls_veiculos ON public.veiculos;
CREATE TRIGGER trg_validate_image_urls_veiculos
  BEFORE INSERT OR UPDATE ON public.veiculos
  FOR EACH ROW
  EXECUTE FUNCTION validate_image_urls();

DROP TRIGGER IF EXISTS trg_validate_image_urls_profiles ON public.profiles;
CREATE TRIGGER trg_validate_image_urls_profiles
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION validate_image_urls();

-- ═══════════════════════════════════════════════════════════════════
-- FIX 6: Truncation triggers para campos text críticos em clientes
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.validate_input_lengths()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Clientes
  IF TG_TABLE_NAME = 'clientes' THEN
    IF NEW.nome IS NOT NULL AND LENGTH(NEW.nome) > 255 THEN
      NEW.nome := LEFT(NEW.nome, 255);
    END IF;
    IF NEW.telefone IS NOT NULL AND LENGTH(NEW.telefone) > 30 THEN
      NEW.telefone := LEFT(NEW.telefone, 30);
    END IF;
    IF NEW.email IS NOT NULL AND LENGTH(NEW.email) > 255 THEN
      NEW.email := LEFT(NEW.email, 255);
    END IF;
    IF NEW.cpf_cnpj IS NOT NULL AND LENGTH(NEW.cpf_cnpj) > 20 THEN
      NEW.cpf_cnpj := LEFT(NEW.cpf_cnpj, 20);
    END IF;
    IF NEW.observacoes IS NOT NULL AND LENGTH(NEW.observacoes) > 5000 THEN
      NEW.observacoes := LEFT(NEW.observacoes, 5000);
    END IF;
    IF NEW.endereco IS NOT NULL AND LENGTH(NEW.endereco) > 500 THEN
      NEW.endereco := LEFT(NEW.endereco, 500);
    END IF;
  END IF;
  
  -- Estoque
  IF TG_TABLE_NAME = 'estoque' THEN
    IF NEW.nome IS NOT NULL AND LENGTH(NEW.nome) > 255 THEN
      NEW.nome := LEFT(NEW.nome, 255);
    END IF;
    IF NEW.categoria IS NOT NULL AND LENGTH(NEW.categoria) > 100 THEN
      NEW.categoria := LEFT(NEW.categoria, 100);
    END IF;
    IF NEW.codigo IS NOT NULL AND LENGTH(NEW.codigo) > 50 THEN
      NEW.codigo := LEFT(NEW.codigo, 50);
    END IF;
    IF NEW.localizacao IS NOT NULL AND LENGTH(NEW.localizacao) > 255 THEN
      NEW.localizacao := LEFT(NEW.localizacao, 255);
    END IF;
  END IF;
  
  -- Oficinas
  IF TG_TABLE_NAME = 'oficinas' THEN
    IF NEW.nome IS NOT NULL AND LENGTH(NEW.nome) > 255 THEN
      NEW.nome := LEFT(NEW.nome, 255);
    END IF;
    IF NEW.telefone IS NOT NULL AND LENGTH(NEW.telefone) > 30 THEN
      NEW.telefone := LEFT(NEW.telefone, 30);
    END IF;
    IF NEW.endereco IS NOT NULL AND LENGTH(NEW.endereco) > 500 THEN
      NEW.endereco := LEFT(NEW.endereco, 500);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_input_lengths_clientes ON public.clientes;
CREATE TRIGGER trg_validate_input_lengths_clientes
  BEFORE INSERT OR UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION validate_input_lengths();

DROP TRIGGER IF EXISTS trg_validate_input_lengths_estoque ON public.estoque;
CREATE TRIGGER trg_validate_input_lengths_estoque
  BEFORE INSERT OR UPDATE ON public.estoque
  FOR EACH ROW
  EXECUTE FUNCTION validate_input_lengths();

DROP TRIGGER IF EXISTS trg_validate_input_lengths_oficinas ON public.oficinas;
CREATE TRIGGER trg_validate_input_lengths_oficinas
  BEFORE INSERT OR UPDATE ON public.oficinas
  FOR EACH ROW
  EXECUTE FUNCTION validate_input_lengths();

-- ═══════════════════════════════════════════════════════════════════
-- FIX 7: Validar fotos_entrada/fotos_saida na OS (arrays de URLs)
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.validate_os_photo_urls()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_clean_urls text[];
  v_url text;
BEGIN
  -- Validate fotos_entrada
  IF NEW.fotos_entrada IS NOT NULL AND array_length(NEW.fotos_entrada, 1) > 0 THEN
    v_clean_urls := '{}';
    FOREACH v_url IN ARRAY NEW.fotos_entrada LOOP
      IF v_url LIKE '%supabase%' OR v_url LIKE '/storage/%' OR v_url LIKE 'blob:%' THEN
        v_clean_urls := array_append(v_clean_urls, v_url);
      END IF;
    END LOOP;
    -- Limit to 20 photos max
    IF array_length(v_clean_urls, 1) > 20 THEN
      v_clean_urls := v_clean_urls[1:20];
    END IF;
    NEW.fotos_entrada := v_clean_urls;
  END IF;
  
  -- Validate fotos_saida
  IF NEW.fotos_saida IS NOT NULL AND array_length(NEW.fotos_saida, 1) > 0 THEN
    v_clean_urls := '{}';
    FOREACH v_url IN ARRAY NEW.fotos_saida LOOP
      IF v_url LIKE '%supabase%' OR v_url LIKE '/storage/%' OR v_url LIKE 'blob:%' THEN
        v_clean_urls := array_append(v_clean_urls, v_url);
      END IF;
    END LOOP;
    IF array_length(v_clean_urls, 1) > 20 THEN
      v_clean_urls := v_clean_urls[1:20];
    END IF;
    NEW.fotos_saida := v_clean_urls;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_os_photo_urls ON public.ordens_servico;
CREATE TRIGGER trg_validate_os_photo_urls
  BEFORE INSERT OR UPDATE ON public.ordens_servico
  FOR EACH ROW
  EXECUTE FUNCTION validate_os_photo_urls();