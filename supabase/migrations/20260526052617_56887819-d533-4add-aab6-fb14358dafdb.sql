
-- =========================================================================
-- FASE 1.1 — Schema do Agendamento Online
-- =========================================================================

-- 1) oficina_configuracoes: novos campos
ALTER TABLE public.oficina_configuracoes
  ADD COLUMN IF NOT EXISTS agendamento_online_ativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS agendamento_online_slug text,
  ADD COLUMN IF NOT EXISTS agendamento_online_horarios jsonb NOT NULL DEFAULT jsonb_build_object(
    'seg', jsonb_build_object('aberto', true, 'abre', '08:00', 'fecha', '18:00', 'pausa_inicio', '12:00', 'pausa_fim', '13:00'),
    'ter', jsonb_build_object('aberto', true, 'abre', '08:00', 'fecha', '18:00', 'pausa_inicio', '12:00', 'pausa_fim', '13:00'),
    'qua', jsonb_build_object('aberto', true, 'abre', '08:00', 'fecha', '18:00', 'pausa_inicio', '12:00', 'pausa_fim', '13:00'),
    'qui', jsonb_build_object('aberto', true, 'abre', '08:00', 'fecha', '18:00', 'pausa_inicio', '12:00', 'pausa_fim', '13:00'),
    'sex', jsonb_build_object('aberto', true, 'abre', '08:00', 'fecha', '18:00', 'pausa_inicio', '12:00', 'pausa_fim', '13:00'),
    'sab', jsonb_build_object('aberto', true, 'abre', '08:00', 'fecha', '12:00'),
    'dom', jsonb_build_object('aberto', false)
  ),
  ADD COLUMN IF NOT EXISTS agendamento_online_capacidade_simultanea int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS agendamento_online_duracao_slot_minutos int NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS agendamento_online_servicos_permitidos uuid[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS agendamento_online_dias_antecedencia_max int NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS agendamento_online_mostrar_precos boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS agendamento_online_mensagem_confirmacao text DEFAULT 'Olá {{cliente_nome}}! Recebemos seu pedido de agendamento de {{servico}} para {{data}} às {{hora}}. Vamos confirmar em breve. — {{oficina}}',
  ADD COLUMN IF NOT EXISTS agendamento_online_mensagem_aprovacao text DEFAULT 'Olá {{cliente_nome}}! Seu agendamento de {{servico}} para {{data}} às {{hora}} foi CONFIRMADO. Te esperamos! — {{oficina}}',
  ADD COLUMN IF NOT EXISTS agendamento_online_mensagem_recusa text DEFAULT 'Olá {{cliente_nome}}, infelizmente não conseguimos atender no horário pedido ({{data}} às {{hora}}). Motivo: {{motivo}}. Entre em contato pra remarcarmos. — {{oficina}}',
  ADD COLUMN IF NOT EXISTS agendamento_online_mensagem_sugestao text DEFAULT 'Olá {{cliente_nome}}, podemos atender você em {{nova_data}} às {{nova_hora}} para o serviço {{servico}}. Pode confirmar? — {{oficina}}';

-- Índice único parcial para o slug (apenas quando preenchido)
CREATE UNIQUE INDEX IF NOT EXISTS idx_oficina_config_slug_unico
  ON public.oficina_configuracoes (agendamento_online_slug)
  WHERE agendamento_online_slug IS NOT NULL;

-- Trigger de validação (substitui CHECK constraint conforme regra do projeto)
CREATE OR REPLACE FUNCTION public.validar_agendamento_online_config()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reservados text[] := ARRAY['auth','app','admin','os','orcamento','cliente','agendar','api','dashboard','login','signup','painel','onboarding','upgrade','configuracoes','financeiro','estoque','servicos','agenda','veiculos','clientes','relatorios','notificacoes','suporte','politica','termos','reset','instalar'];
BEGIN
  -- Slug: regex + reservados
  IF NEW.agendamento_online_slug IS NOT NULL THEN
    NEW.agendamento_online_slug := lower(trim(NEW.agendamento_online_slug));
    IF NEW.agendamento_online_slug !~ '^[a-z0-9][a-z0-9-]{2,39}$' THEN
      RAISE EXCEPTION 'Slug inválido. Use apenas letras minúsculas, números e hífens (3-40 caracteres, começando com letra ou número).'
        USING ERRCODE = '22023';
    END IF;
    IF NEW.agendamento_online_slug = ANY(reservados) THEN
      RAISE EXCEPTION 'Slug "%" é reservado pelo sistema. Escolha outro.', NEW.agendamento_online_slug
        USING ERRCODE = '22023';
    END IF;
  END IF;

  -- Capacidade e duração
  IF NEW.agendamento_online_capacidade_simultanea < 1 OR NEW.agendamento_online_capacidade_simultanea > 50 THEN
    RAISE EXCEPTION 'Capacidade simultânea deve estar entre 1 e 50.' USING ERRCODE = '22023';
  END IF;
  IF NEW.agendamento_online_duracao_slot_minutos < 15 OR NEW.agendamento_online_duracao_slot_minutos > 480 THEN
    RAISE EXCEPTION 'Duração do slot deve estar entre 15 e 480 minutos.' USING ERRCODE = '22023';
  END IF;
  IF NEW.agendamento_online_dias_antecedencia_max < 1 OR NEW.agendamento_online_dias_antecedencia_max > 365 THEN
    RAISE EXCEPTION 'Antecedência máxima deve estar entre 1 e 365 dias.' USING ERRCODE = '22023';
  END IF;

  -- Se ativo, exige slug
  IF NEW.agendamento_online_ativo = true AND NEW.agendamento_online_slug IS NULL THEN
    RAISE EXCEPTION 'Para ativar o agendamento online, defina um slug público.' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_agendamento_online_config ON public.oficina_configuracoes;
CREATE TRIGGER trg_validar_agendamento_online_config
  BEFORE INSERT OR UPDATE ON public.oficina_configuracoes
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_agendamento_online_config();

-- 2) ordens_servico: vínculo opcional com solicitação
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS solicitacao_agendamento_id uuid;

-- 3) Nova tabela solicitacoes_agendamento
CREATE TABLE IF NOT EXISTS public.solicitacoes_agendamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oficina_id uuid NOT NULL,
  cliente_nome text NOT NULL,
  cliente_telefone text NOT NULL,
  cliente_email text,
  veiculo_placa text,
  veiculo_modelo text,
  servico_id uuid,
  servico_nome text NOT NULL,
  servico_valor_estimado numeric DEFAULT 0,
  data_agendamento_solicitada date NOT NULL,
  hora_agendamento_solicitada time NOT NULL,
  observacoes_cliente text,
  status text NOT NULL DEFAULT 'pendente',
  data_aprovacao timestamptz,
  data_recusa timestamptz,
  data_sugestao timestamptz,
  nova_data_sugerida date,
  nova_hora_sugerida time,
  motivo_recusa text,
  ordem_servico_id uuid,
  ip_solicitante inet,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- FK opcional para vincular OS criada
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_ordens_servico_solicitacao'
  ) THEN
    ALTER TABLE public.ordens_servico
      ADD CONSTRAINT fk_ordens_servico_solicitacao
      FOREIGN KEY (solicitacao_agendamento_id)
      REFERENCES public.solicitacoes_agendamento(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- Validação de status via trigger
CREATE OR REPLACE FUNCTION public.validar_solicitacao_agendamento_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status NOT IN ('pendente','aprovado','recusado','sugerido','cancelado') THEN
    RAISE EXCEPTION 'Status inválido: %. Valores aceitos: pendente, aprovado, recusado, sugerido, cancelado.', NEW.status
      USING ERRCODE = '22023';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_solicitacao_status ON public.solicitacoes_agendamento;
CREATE TRIGGER trg_validar_solicitacao_status
  BEFORE INSERT OR UPDATE ON public.solicitacoes_agendamento
  FOR EACH ROW
  EXECUTE FUNCTION public.validar_solicitacao_agendamento_status();

-- Índices
CREATE INDEX IF NOT EXISTS idx_solic_agend_oficina_status_created
  ON public.solicitacoes_agendamento (oficina_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_solic_agend_oficina_data
  ON public.solicitacoes_agendamento (oficina_id, data_agendamento_solicitada);
CREATE INDEX IF NOT EXISTS idx_solic_agend_telefone
  ON public.solicitacoes_agendamento (cliente_telefone, created_at DESC);

-- Índice de apoio em catalogo_servicos (faltante)
CREATE INDEX IF NOT EXISTS idx_catalogo_servicos_oficina
  ON public.catalogo_servicos (oficina_id, ativo);

-- RLS
ALTER TABLE public.solicitacoes_agendamento ENABLE ROW LEVEL SECURITY;

-- Oficina vê suas solicitações
CREATE POLICY "solic_agend_select"
  ON public.solicitacoes_agendamento
  FOR SELECT
  TO authenticated
  USING (has_oficina_access(auth.uid(), oficina_id));

-- Oficina atualiza (aprovar/recusar/sugerir/cancelar)
CREATE POLICY "solic_agend_update"
  ON public.solicitacoes_agendamento
  FOR UPDATE
  TO authenticated
  USING (has_oficina_access(auth.uid(), oficina_id));

-- Apenas dono pode apagar
CREATE POLICY "solic_agend_delete"
  ON public.solicitacoes_agendamento
  FOR DELETE
  TO authenticated
  USING (is_oficina_owner(auth.uid(), oficina_id));

-- INSERT direto BLOQUEADO para authenticated e anon — entradas só via RPC SECURITY DEFINER
-- (não criamos policy de INSERT — RLS nega por padrão)

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.solicitacoes_agendamento;

-- Trigger: notificar oficina ao chegar nova solicitação
CREATE OR REPLACE FUNCTION public.notificar_nova_solicitacao_agendamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pendente' THEN
    INSERT INTO public.notificacoes (oficina_id, tipo, titulo, mensagem, referencia_tipo, referencia_id, data)
    VALUES (
      NEW.oficina_id,
      'agendamento_solicitado',
      'Novo pedido de agendamento',
      NEW.cliente_nome || ' pediu ' || NEW.servico_nome || ' em ' ||
        to_char(NEW.data_agendamento_solicitada, 'DD/MM') || ' às ' ||
        to_char(NEW.hora_agendamento_solicitada, 'HH24:MI'),
      'solicitacao_agendamento',
      NEW.id,
      CURRENT_DATE
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notificar_nova_solicitacao ON public.solicitacoes_agendamento;
CREATE TRIGGER trg_notificar_nova_solicitacao
  AFTER INSERT ON public.solicitacoes_agendamento
  FOR EACH ROW
  EXECUTE FUNCTION public.notificar_nova_solicitacao_agendamento();
