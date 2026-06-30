REVOKE EXECUTE ON FUNCTION public.ingest_upsert_bypass_triggers(text, jsonb, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.ingest_upsert_bypass_triggers(text, jsonb, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ingest_upsert_bypass_triggers(text, jsonb, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ingest_upsert_bypass_triggers(text, jsonb, text) TO service_role;