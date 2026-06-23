CREATE OR REPLACE FUNCTION public.audit_role_changes()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (
      oficina_id,
      user_id,
      action,
      table_name,
      record_id,
      new_data
    ) VALUES (
      NEW.oficina_id,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid), -- Fallback para sistema
      'ROLE_GRANTED',
      'user_roles',
      NEW.id,
      jsonb_build_object('user_id', NEW.user_id, 'role', NEW.role)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (
      oficina_id,
      user_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data
    ) VALUES (
      NEW.oficina_id,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'ROLE_CHANGED',
      'user_roles',
      NEW.id,
      jsonb_build_object('user_id', OLD.user_id, 'role', OLD.role),
      jsonb_build_object('user_id', NEW.user_id, 'role', NEW.role)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (
      oficina_id,
      user_id,
      action,
      table_name,
      record_id,
      old_data
    ) VALUES (
      OLD.oficina_id,
      COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
      'ROLE_REVOKED',
      'user_roles',
      OLD.id,
      jsonb_build_object('user_id', OLD.user_id, 'role', OLD.role)
    );
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$function$;
