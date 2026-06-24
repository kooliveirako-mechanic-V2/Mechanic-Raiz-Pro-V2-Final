-- Contenção de superfície: aplicar REVOKE/GRANT em todas as assinaturas reais das RPCs internas.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'criar_venda_balcao',
        'cancelar_venda_balcao',
        'criar_orcamento_completo',
        'converter_orcamento_em_os',
        'criar_os_completa',
        'finalizar_os_atomica',
        'gerar_parcelas_atomic',
        'registrar_sinal_os'
      )
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM PUBLIC', r.nspname, r.proname, r.args);
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon', r.nspname, r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO authenticated', r.nspname, r.proname, r.args);
  END LOOP;
END $$;