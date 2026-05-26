
-- Add RLS policies to idempotency_keys table
-- Only edge functions (service role) and the owning oficina should access these

CREATE POLICY "Users can view their oficina idempotency keys"
ON public.idempotency_keys
FOR SELECT
USING (public.has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Users can insert idempotency keys for their oficina"
ON public.idempotency_keys
FOR INSERT
WITH CHECK (public.has_oficina_access(auth.uid(), oficina_id));

CREATE POLICY "Users can delete their oficina idempotency keys"
ON public.idempotency_keys
FOR DELETE
USING (public.has_oficina_access(auth.uid(), oficina_id));
