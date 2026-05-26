-- Allow authenticated users to delete estoque_movimentacoes for their oficina
CREATE POLICY "estmov_delete"
ON public.estoque_movimentacoes
FOR DELETE
TO authenticated
USING (has_oficina_access(auth.uid(), oficina_id));