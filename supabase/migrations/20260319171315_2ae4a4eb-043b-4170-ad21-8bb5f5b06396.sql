
-- Fix the financeiro history trigger to handle system operations (no auth context)
CREATE OR REPLACE FUNCTION public.registrar_historico_financeiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Skip history if no authenticated user (system/recovery operations)
    IF auth.uid() IS NOT NULL THEN
      INSERT INTO public.financeiro_historico (financeiro_id, oficina_id, user_id, acao, dados_novos)
      VALUES (NEW.id, NEW.oficina_id, auth.uid(), 'criacao', to_jsonb(NEW));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF auth.uid() IS NOT NULL THEN
      INSERT INTO public.financeiro_historico (financeiro_id, oficina_id, user_id, acao, dados_anteriores, dados_novos)
      VALUES (NEW.id, NEW.oficina_id, auth.uid(), 'edicao', to_jsonb(OLD), to_jsonb(NEW));
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;
