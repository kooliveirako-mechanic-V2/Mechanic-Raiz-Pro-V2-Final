-- ═══════════════════════════════════════════════════════════════════════════
-- FIX FUNCTION SEARCH PATH - Corrigir warnings de segurança
-- ═══════════════════════════════════════════════════════════════════════════

-- Corrigir mask_cpf_cnpj com search_path
CREATE OR REPLACE FUNCTION public.mask_cpf_cnpj(cpf_cnpj text, can_view boolean)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN can_view OR cpf_cnpj IS NULL THEN cpf_cnpj
    WHEN LENGTH(cpf_cnpj) = 11 THEN '***.' || SUBSTRING(cpf_cnpj FROM 4 FOR 3) || '.***-**'
    WHEN LENGTH(cpf_cnpj) = 14 THEN '**.' || SUBSTRING(cpf_cnpj FROM 3 FOR 3) || '.***/' || SUBSTRING(cpf_cnpj FROM 9 FOR 4) || '-**'
    ELSE REPEAT('*', LENGTH(cpf_cnpj) - 4) || RIGHT(cpf_cnpj, 4)
  END
$$;

-- Corrigir mask_chassi com search_path
CREATE OR REPLACE FUNCTION public.mask_chassi(chassi text, can_view boolean)
RETURNS text
LANGUAGE sql
IMMUTABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN can_view OR chassi IS NULL THEN chassi
    WHEN LENGTH(chassi) > 8 THEN REPEAT('*', LENGTH(chassi) - 8) || RIGHT(chassi, 8)
    ELSE REPEAT('*', LENGTH(chassi))
  END
$$;