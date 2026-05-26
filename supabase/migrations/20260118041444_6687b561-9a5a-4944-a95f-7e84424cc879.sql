-- Modificar a função de auditoria para permitir inserções quando não há usuário autenticado
CREATE OR REPLACE FUNCTION public.log_audit_action()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_oficina_id uuid;
  v_old_data jsonb;
  v_new_data jsonb;
  v_user_id uuid;
BEGIN
  -- Obter user_id do contexto de autenticação
  v_user_id := auth.uid();
  
  -- Se não houver usuário autenticado, não registrar log (permite operações administrativas)
  IF v_user_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;
  
  -- Determinar oficina_id baseado na tabela
  IF TG_TABLE_NAME = 'oficinas' THEN
    v_oficina_id := COALESCE(NEW.id, OLD.id);
  ELSIF TG_OP = 'DELETE' THEN
    v_oficina_id := OLD.oficina_id;
  ELSE
    v_oficina_id := NEW.oficina_id;
  END IF;

  -- Preparar dados
  IF TG_OP = 'DELETE' THEN
    v_old_data := to_jsonb(OLD);
    v_new_data := NULL;
  ELSIF TG_OP = 'INSERT' THEN
    v_old_data := NULL;
    v_new_data := to_jsonb(NEW);
  ELSE
    v_old_data := to_jsonb(OLD);
    v_new_data := to_jsonb(NEW);
  END IF;

  -- Inserir log
  INSERT INTO public.audit_logs (
    oficina_id,
    user_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  ) VALUES (
    v_oficina_id,
    v_user_id,
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    v_old_data,
    v_new_data
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;