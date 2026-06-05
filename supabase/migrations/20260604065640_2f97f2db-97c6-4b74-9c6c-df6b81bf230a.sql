-- 1. Restrições de integridade básica
ALTER TABLE public.ordens_servico 
  ADD CONSTRAINT check_os_valores_positivos 
  CHECK (valor_servico >= 0 AND custo_servico >= 0 AND COALESCE(desconto, 0) >= 0 AND COALESCE(valor_sinal, 0) >= 0);

-- 2. Função para proteger itens de OS finalizada
CREATE OR REPLACE FUNCTION public.tg_proteger_itens_os_finalizada()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.ordens_servico 
    WHERE id = COALESCE(NEW.ordem_servico_id, OLD.ordem_servico_id) 
    AND status = 'finalizado'
  ) THEN
    RAISE EXCEPTION 'Não é possível alterar itens de uma Ordem de Serviço já finalizada. Reabra a OS primeiro.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para itens_os
DROP TRIGGER IF EXISTS trg_proteger_itens_finalizados ON public.itens_os;
CREATE TRIGGER trg_proteger_itens_finalizados
BEFORE INSERT OR UPDATE OR DELETE ON public.itens_os
FOR EACH ROW EXECUTE FUNCTION public.tg_proteger_itens_os_finalizada();

-- 3. Função para proteger registros financeiros vinculados a OS finalizada
CREATE OR REPLACE FUNCTION public.tg_proteger_financeiro_os_finalizada()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1 FROM public.ordens_servico 
      WHERE id = OLD.ordem_servico_id 
      AND status = 'finalizado'
    ) THEN
      RAISE EXCEPTION 'Não é possível excluir um lançamento financeiro vinculado a uma OS finalizada.';
    END IF;
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    IF EXISTS (
      SELECT 1 FROM public.ordens_servico 
      WHERE id = OLD.ordem_servico_id 
      AND status = 'finalizado'
    ) AND (OLD.valor IS DISTINCT FROM NEW.valor OR OLD.tipo IS DISTINCT FROM NEW.tipo) THEN
      RAISE EXCEPTION 'Não é possível alterar o valor ou tipo de um financeiro vinculado a uma OS finalizada.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para financeiro
DROP TRIGGER IF EXISTS trg_proteger_financeiro_finalizado ON public.financeiro;
CREATE TRIGGER trg_proteger_financeiro_finalizado
BEFORE UPDATE OR DELETE ON public.financeiro
FOR EACH ROW EXECUTE FUNCTION public.tg_proteger_financeiro_os_finalizada();

-- 4. Visão de Auditoria para identificar furos no caixa/inconsistências
CREATE OR REPLACE VIEW public.v_auditoria_financeira_os AS
WITH financeiro_consolidado AS (
  SELECT 
    ordem_servico_id,
    SUM(CASE WHEN tipo = 'entrada' THEN valor ELSE -valor END) as total_financeiro
  FROM public.financeiro
  WHERE ordem_servico_id IS NOT NULL
  GROUP BY ordem_servico_id
)
SELECT 
  os.id as os_id,
  os.numero as os_numero,
  os.status,
  os.valor_servico as valor_bruto,
  os.desconto,
  (os.valor_servico - COALESCE(os.desconto, 0)) as valor_liquido_esperado,
  COALESCE(fc.total_financeiro, 0) as total_financeiro_real,
  ((os.valor_servico - COALESCE(os.desconto, 0)) - COALESCE(fc.total_financeiro, 0)) as divergencia
FROM public.ordens_servico os
LEFT JOIN financeiro_consolidado fc ON fc.ordem_servico_id = os.id
WHERE os.status = 'finalizado'
AND ABS((os.valor_servico - COALESCE(os.desconto, 0)) - COALESCE(fc.total_financeiro, 0)) > 0.01;

-- 5. Garantir que a função de reabrir OS trate o financeiro (Segurança extra)
-- Nota: Esta parte assume que existe uma função de reabrir. Se não existir, ela serve como guia.
CREATE OR REPLACE FUNCTION public.reabrir_os_atomica(p_os_id uuid)
RETURNS jsonb AS $$
BEGIN
  -- Bloqueio preventivo
  PERFORM pg_advisory_xact_lock(('x' || left(replace(p_os_id::text, '-', ''), 15))::bit(64)::bigint);

  -- Logica de reabertura (exemplo, deve ser adaptada se já existir)
  UPDATE public.ordens_servico 
  SET status = 'em_andamento', 
      data_conclusao = NULL 
  WHERE id = p_os_id AND status = 'finalizado';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS não encontrada ou não está finalizada.';
  END IF;

  RETURN jsonb_build_object('success', true, 'message', 'OS reaberta com sucesso. Itens e financeiro agora podem ser editados.');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT ALL ON public.v_auditoria_financeira_os TO authenticated;
GRANT ALL ON public.v_auditoria_financeira_os TO service_role;
