DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'orcamentos' 
        AND policyname = 'Acesso público para orçamentos via UUID'
    ) THEN
        CREATE POLICY "Acesso público para orçamentos via UUID" 
        ON public.orcamentos 
        FOR SELECT 
        TO anon, authenticated 
        USING (true);
    END IF;
END $$;

-- Garantir que anon tenha permissão de select na tabela se não tiver
GRANT SELECT ON public.orcamentos TO anon;
GRANT SELECT ON public.itens_orcamento TO anon;
