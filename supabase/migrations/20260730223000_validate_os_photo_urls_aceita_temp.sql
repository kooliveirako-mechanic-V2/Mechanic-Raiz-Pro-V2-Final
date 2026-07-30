-- ============================================================
-- validate_os_photo_urls: aceitar path temp/<user_id>/<arquivo>
-- ============================================================
-- CONTEXTO: a migração para bucket privado (fix/os-fotos-signed-urls) passou a
-- gravar PATH RELATIVO em fotos_entrada/fotos_saida em vez de URL absoluta.
-- Uploads feitos ANTES de a OS existir usam temp/<user_id>/<arquivo> — o
-- prefixo temp/ não casa nenhuma condição atual do trigger:
--   %supabase% | /storage/% | blob:% | ^<uuid>/...
-- Resultado provado (2026-07-30): temp/... é DESCARTADO silenciosamente.
-- Antes isso não acontecia porque o código gravava URL absoluta (continha
-- "supabase"). Sem este ajuste, foto anexada em OS nova some ao salvar.
--
-- Este trigger NÃO toca o bucket nem as policies. É só a validação de conteúdo
-- do array. Idempotente (CREATE OR REPLACE).
-- ============================================================

CREATE OR REPLACE FUNCTION public.validate_os_photo_urls()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_clean_urls text[];
  v_url        text;
  c_relpath    constant text :=
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/].+$';
  -- upload feito ANTES da OS existir: temp/<user_id>/<arquivo>
  c_temppath   constant text :=
    '^temp/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/].+$';
BEGIN
  IF NEW.fotos_entrada IS NOT NULL AND array_length(NEW.fotos_entrada, 1) > 0 THEN
    v_clean_urls := '{}';
    FOREACH v_url IN ARRAY NEW.fotos_entrada LOOP
      IF position('..' in v_url) = 0
         AND (
           v_url LIKE '%supabase%'
           OR v_url LIKE '/storage/%'
           OR v_url LIKE 'blob:%'
           OR v_url ~* c_relpath
           OR v_url ~* c_temppath
         )
      THEN
        v_clean_urls := array_append(v_clean_urls, v_url);
      END IF;
    END LOOP;
    IF array_length(v_clean_urls, 1) > 20 THEN
      v_clean_urls := v_clean_urls[1:20];
    END IF;
    NEW.fotos_entrada := v_clean_urls;
  END IF;

  IF NEW.fotos_saida IS NOT NULL AND array_length(NEW.fotos_saida, 1) > 0 THEN
    v_clean_urls := '{}';
    FOREACH v_url IN ARRAY NEW.fotos_saida LOOP
      IF position('..' in v_url) = 0
         AND (
           v_url LIKE '%supabase%'
           OR v_url LIKE '/storage/%'
           OR v_url LIKE 'blob:%'
           OR v_url ~* c_relpath
           OR v_url ~* c_temppath
         )
      THEN
        v_clean_urls := array_append(v_clean_urls, v_url);
      END IF;
    END LOOP;
    IF array_length(v_clean_urls, 1) > 20 THEN
      v_clean_urls := v_clean_urls[1:20];
    END IF;
    NEW.fotos_saida := v_clean_urls;
  END IF;

  RETURN NEW;
END;
$function$;
