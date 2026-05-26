-- 1. Colunas de desconto na OS
ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS desconto numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS desconto_motivo text,
  ADD COLUMN IF NOT EXISTS desconto_aplicado_por uuid,
  ADD COLUMN IF NOT EXISTS desconto_aplicado_em timestamptz;

-- 2. Recalcular coluna gerada `lucro` para subtrair desconto
ALTER TABLE public.ordens_servico DROP COLUMN IF EXISTS lucro;
ALTER TABLE public.ordens_servico
  ADD COLUMN lucro numeric
  GENERATED ALWAYS AS (
    COALESCE(valor_servico, 0) - COALESCE(custo_servico, 0) - COALESCE(desconto, 0)
  ) STORED;

-- 3. Validação de desconto (trigger pois CHECK não pode usar outras colunas mutáveis)
CREATE OR REPLACE FUNCTION public.validar_desconto_os()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.desconto IS NULL THEN
    NEW.desconto := 0;
  END IF;
  IF NEW.desconto < 0 THEN
    RAISE EXCEPTION 'Desconto não pode ser negativo';
  END IF;
  IF NEW.desconto > COALESCE(NEW.valor_servico, 0) THEN
    RAISE EXCEPTION 'Desconto (R$ %) não pode ser maior que o total da OS (R$ %)',
      NEW.desconto, COALESCE(NEW.valor_servico, 0);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_desconto_os ON public.ordens_servico;
CREATE TRIGGER trg_validar_desconto_os
BEFORE INSERT OR UPDATE OF desconto, valor_servico ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.validar_desconto_os();

-- 4. Auditoria automática de mudança de desconto
CREATE OR REPLACE FUNCTION public.auditar_desconto_os()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF COALESCE(NEW.desconto,0) <> COALESCE(OLD.desconto,0)
     OR COALESCE(NEW.desconto_motivo,'') <> COALESCE(OLD.desconto_motivo,'') THEN
    NEW.desconto_aplicado_por := v_uid;
    NEW.desconto_aplicado_em := now();

    IF v_uid IS NOT NULL THEN
      INSERT INTO public.audit_logs (
        oficina_id, user_id, table_name, record_id, action, old_data, new_data
      ) VALUES (
        NEW.oficina_id, v_uid, 'ordens_servico', NEW.id,
        'desconto_alterado',
        jsonb_build_object('desconto', OLD.desconto, 'motivo', OLD.desconto_motivo),
        jsonb_build_object('desconto', NEW.desconto, 'motivo', NEW.desconto_motivo)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auditar_desconto_os ON public.ordens_servico;
CREATE TRIGGER trg_auditar_desconto_os
BEFORE UPDATE OF desconto, desconto_motivo ON public.ordens_servico
FOR EACH ROW EXECUTE FUNCTION public.auditar_desconto_os();

-- 5. Comentários documentais
COMMENT ON COLUMN public.ordens_servico.desconto IS 'Desconto em R$ aplicado sobre valor_servico (Master Total). Reduz lucro proporcionalmente.';
COMMENT ON COLUMN public.ordens_servico.desconto_motivo IS 'Motivo livre/categoria do desconto (ex: Cliente fiel, À vista).';
COMMENT ON COLUMN public.ordens_servico.lucro IS 'GENERATED: valor_servico - custo_servico - desconto.';