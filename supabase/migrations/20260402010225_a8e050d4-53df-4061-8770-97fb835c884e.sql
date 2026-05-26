
-- ═══════════════════════════════════════════════════════════════
-- RATE LIMITING POR USUÁRIO AUTENTICADO
-- Protege contra criação massiva via script
-- ═══════════════════════════════════════════════════════════════

-- Função de rate limit por usuário autenticado
CREATE OR REPLACE FUNCTION public.check_user_rate_limit(
  p_action TEXT,
  p_max_requests INT DEFAULT 30,
  p_window_seconds INT DEFAULT 60
) RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_count INT;
  v_identifier TEXT;
BEGIN
  IF v_user_id IS NULL THEN RETURN FALSE; END IF;

  v_identifier := v_user_id::text || ':' || p_action;

  SELECT COUNT(*) INTO v_count
  FROM rate_limit_log
  WHERE ip_hash = v_identifier
  AND endpoint = p_action
  AND created_at > NOW() - (p_window_seconds || ' seconds')::INTERVAL;

  IF v_count >= p_max_requests THEN
    RETURN FALSE;
  END IF;

  INSERT INTO rate_limit_log (ip_hash, endpoint, created_at)
  VALUES (v_identifier, p_action, NOW());

  RETURN TRUE;
END;
$$;

-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: Rate limit na criação de Ordens de Serviço (30/min)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rate_limit_os_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT check_user_rate_limit('criar_os', 30, 60) THEN
    RAISE EXCEPTION 'rate_limit_exceeded'
    USING HINT = 'Muitas operações em pouco tempo. Aguarde um momento.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rate_limit_os_insert ON ordens_servico;
CREATE TRIGGER trg_rate_limit_os_insert
  BEFORE INSERT ON ordens_servico
  FOR EACH ROW EXECUTE FUNCTION rate_limit_os_insert();

-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: Rate limit na criação de Clientes (20/min)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rate_limit_clientes_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT check_user_rate_limit('criar_cliente', 20, 60) THEN
    RAISE EXCEPTION 'rate_limit_exceeded'
    USING HINT = 'Muitas operações em pouco tempo. Aguarde um momento.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rate_limit_clientes_insert ON clientes;
CREATE TRIGGER trg_rate_limit_clientes_insert
  BEFORE INSERT ON clientes
  FOR EACH ROW EXECUTE FUNCTION rate_limit_clientes_insert();

-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: Rate limit na criação de Orçamentos (20/min)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rate_limit_orcamentos_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT check_user_rate_limit('criar_orcamento', 20, 60) THEN
    RAISE EXCEPTION 'rate_limit_exceeded'
    USING HINT = 'Muitas operações em pouco tempo. Aguarde um momento.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rate_limit_orcamentos_insert ON orcamentos;
CREATE TRIGGER trg_rate_limit_orcamentos_insert
  BEFORE INSERT ON orcamentos
  FOR EACH ROW EXECUTE FUNCTION rate_limit_orcamentos_insert();

-- ═══════════════════════════════════════════════════════════════
-- TRIGGER: Rate limit na criação de Estoque (30/min)
-- ═══════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.rate_limit_estoque_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT check_user_rate_limit('criar_estoque', 30, 60) THEN
    RAISE EXCEPTION 'rate_limit_exceeded'
    USING HINT = 'Muitas operações em pouco tempo. Aguarde um momento.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rate_limit_estoque_insert ON estoque;
CREATE TRIGGER trg_rate_limit_estoque_insert
  BEFORE INSERT ON estoque
  FOR EACH ROW EXECUTE FUNCTION rate_limit_estoque_insert();

-- ═══════════════════════════════════════════════════════════════
-- Limpeza automática: remover logs de rate limit > 1 hora
-- (reutiliza cleanup_rate_limit_log existente)
-- ═══════════════════════════════════════════════════════════════
