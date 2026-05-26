-- RPC pública para verificar se um e-mail tem migração legada pendente
-- Não expõe IDs nem dados sensíveis: retorna apenas booleano + nome de exibição opcional
CREATE OR REPLACE FUNCTION public.check_legacy_migration(p_email text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
BEGIN
  IF p_email IS NULL OR length(trim(p_email)) = 0 THEN
    RETURN jsonb_build_object('has_pending', false);
  END IF;

  SELECT nome, migrated_at INTO v_record
  FROM public.user_migration_map
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF v_record IS NULL THEN
    RETURN jsonb_build_object('has_pending', false, 'is_legacy', false);
  END IF;

  RETURN jsonb_build_object(
    'has_pending', v_record.migrated_at IS NULL,
    'is_legacy', true,
    'already_migrated', v_record.migrated_at IS NOT NULL,
    'display_name', v_record.nome
  );
END;
$$;

-- Permite chamada anônima (a função só vaza presença de email legado, não dados)
GRANT EXECUTE ON FUNCTION public.check_legacy_migration(text) TO anon, authenticated;