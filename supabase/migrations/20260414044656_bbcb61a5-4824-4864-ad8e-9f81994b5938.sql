-- Drop the legacy 6-parameter signature (without p_numero_parcelas)
DROP FUNCTION IF EXISTS public.upsert_financeiro_os(uuid, uuid, text, numeric, uuid, text);