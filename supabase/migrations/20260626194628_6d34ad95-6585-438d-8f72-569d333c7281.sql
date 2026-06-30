-- CORREÇÃO C — ia_base_conhecimento: corrigir argumentos invertidos em has_oficina_access
-- Assinatura correta: has_oficina_access(_user_id uuid, _oficina_id uuid)

DROP POLICY IF EXISTS "Users can view own oficina knowledge base" ON public.ia_base_conhecimento;
DROP POLICY IF EXISTS "Users can update own oficina knowledge base" ON public.ia_base_conhecimento;
DROP POLICY IF EXISTS "Users can insert own oficina knowledge base" ON public.ia_base_conhecimento;

CREATE POLICY "Users can view own oficina knowledge base"
ON public.ia_base_conhecimento
FOR SELECT
TO authenticated
USING (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Users can update own oficina knowledge base"
ON public.ia_base_conhecimento
FOR UPDATE
TO authenticated
USING (has_oficina_access(auth.uid(), oficina_id))
WITH CHECK (has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Users can insert own oficina knowledge base"
ON public.ia_base_conhecimento
FOR INSERT
TO authenticated
WITH CHECK (has_oficina_access(auth.uid(), oficina_id));